const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const pdfParse = require('pdf-parse');

process.stdout.setDefaultEncoding('utf-8');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        icon: path.join(__dirname, 'logo.png'),
        width: 800,
        height: 600,
        resizable: true,
        minWidth: 485, // Setting initial minimum width
        minHeight: 600, // Setting initial minimum height

        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    // mainWindow.on('resize', () => {
    //     const { width, height } = mainWindow.getBounds();
    //     console.log(`Current window dimensions: ${width}x${height}`);
    // });

}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});


ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        // filters: [
        //     { name: 'All Files', extensions: ['pdf'] }
        // ]
        // filters don't work with opendirectory
    });
    return result.filePaths;
});


function isValidLine(line) {
    // Skip if line is empty
    if (!line || line.length === 0) return false;

    // Skip if line is too short (less than 5 characters)
    // Or line is too long
    console.log(`String: ${line} \n Length: ${line.length}`)
    if (line.length < 5 || line.length > 50 && (!line.includes(':'))){
        return false;
    }
    
    // Skip if the line text contains full-stop punctuation
    if (line.trim().endsWith('.')) return false;

    // Skip if line is just numbers (including dots and spaces)
    if (/^[\d\s.]+$/.test(line)) return false;

    // Skip if line contains common page number patterns
    // Including "page 78" and "- 78 -"
    if (/^page\s*\d+$/i.test(line) || /^-\s*\d+\s*-$/.test(line)) return false;

    // Skip if line is mostly special characters (allow Korean characters)
    const specialCharRatio = (line.match(/[^a-zA-Z0-9가-힣\s]/g) || []).length / line.length;
    if (specialCharRatio > 0.5) return false;

    return true;
}


ipcMain.handle('process-files', async (event, dirPath) => {
    try {
        const outputDir = path.join(dirPath, 'renamed_files');

        const files = await fs.readdir(dirPath);

        if (files.length== 0){
            return []
        }
        const results = [];

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);

            if (stats.isFile()) {
                try {
                    let nextLine = '';

                    const fileExt = path.extname(file).toLowerCase();

                    if (fileExt === '.pdf') {
                        
                        const dataBuffer = await fs.readFile(filePath);
                        const pdfData = await pdfParse(dataBuffer);
                        extractedText = pdfData.text
                        
                        // console.log(extractedText)

                        // Split the text into lines
                        const lines = extractedText.split('\n');

                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].includes('STATEMENT OF ACCOUNT SUMMARY')) {
                                nextLine = lines[i + 1].trim();
                                break;
                            }
                        }

                        // If PDF is not according to our defined rules then extract the top header looking text and rename with that name
                        console.log(nextLine)
                        if (nextLine.length === 0) {
                            // Find first valid line
                            firstLine = '';
                            for (const line of lines) {
                                if (isValidLine(line)) {
                                    firstLine = line.substring(0, 100); // Get first 100 characters
                                    break;
                                }
                            }
                            nextLine = firstLine
                        }

                    } else {
                        const extension = path.extname(filePath);
                        const errorMessage = `
                            The file ${extension} format is not processed.
                            Only PDFs are supported.
                            Thank you for your patience!
                        `;
                        throw new Error(errorMessage)
                        // const content = await fs.readFile(filePath, 'utf8');
                        // const lines = content.split('\n')
                        //                    .map(line => line.trim())
                        //                    .filter(line => line.length > 0);
                        // // Find first valid line
                        // firstLine = '';
                        // for (const line of lines) {
                        //     if (isValidLine(line)) {
                        //         firstLine = line.substring(0, 100); // Get first 100 characters
                        //         break;
                        //     }
                        // }
                        // nextLine = firstLine;
                    }

                    let newFileName;
                    if (nextLine && nextLine.length > 0) {
                        // Create safe filename from first non-empty line
                        newFileName = nextLine
                            .replace(/[^a-z0-9가-힣]/gi, '_')
                            + fileExt;
                    } else {
                        // If no text found, use original filename
                        newFileName = file;
                    }

                    // Handle duplicate filenames
                    let finalNewPath = path.join(outputDir, newFileName);
                    // let counter = 1;
                    // while (await fs.pathExists(finalNewPath)) {
                    //     const nameWithoutExt = newFileName.slice(0, -fileExt.length);
                    //     newFileName = `${nameWithoutExt}_${counter}${fileExt}`;
                    //     finalNewPath = path.join(outputDir, newFileName);
                    //     counter++;
                    // }

                    await fs.ensureDir(outputDir);

                    await fs.copy(filePath, finalNewPath);

                    results.push({
                        originalName: file,
                        newName: newFileName,
                        success: true,
                        noTextFound: !nextLine
                    });
                } catch (err) {
                    // Handle PDF parsing errors (common with scanned PDFs)
                    if (err.message.includes('PDF') && !err.message.includes('Only PDFs are supported.')) {
                        // If PDF parsing fails, use original filename
                        await fs.ensureDir(outputDir);
                        const newPath = path.join(outputDir, file);
                        await fs.copy(filePath, newPath);
                        results.push({
                            originalName: file,
                            newName: file,
                            success: true,
                            noTextFound: true
                        });
                    } else {
                        results.push({
                            originalName: file,
                            error: err.message,
                            success: false
                        });
                    }
                }
            }
        }

        return results;
    } catch (err) {
        throw err;
    }
});