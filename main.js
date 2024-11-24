const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const pdfParse = require('pdf-parse');

// import { app, BrowserWindow, ipcMain, dialog } from 'electron';
// import path from 'path';
// import fs from 'fs-extra';
// import * as mupdfjs from 'mupdf/mupdfjs';
// console.log("Encoding:", process.stdout.getEncoding());

process.stdout.setDefaultEncoding('utf-8');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        icon: path.join(__dirname, 'logo.png'),
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
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
        properties: ['openDirectory']
    });
    return result.filePaths;
});


function isValidLine(line) {
    // Skip if line is empty
    if (!line || line.length === 0) return false;

    // Skip if line is too short (less than 5 characters)
    if (line.length < 5) return false;

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
        await fs.ensureDir(outputDir);

        const files = await fs.readdir(dirPath);
        const results = [];

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);

            if (stats.isFile()) {
                try {
                    let firstLine = '';
                    const fileExt = path.extname(file).toLowerCase();

                    if (fileExt === '.pdf') {
                        
                        // let doc = mupdfjs.PDFDocument.openDocument(fs.readFileSync(filePath), "application/pdf");
                        // let page = new mupdfjs.PDFPage(doc, 0); // returns the first page of the document
                        // let extractedText = page.getText()
                        
                        // // cleanup
                        // doc.destroy()
                        // page.destroy()
                        
                        const dataBuffer = await fs.readFile(filePath);
                        const pdfData = await pdfParse(dataBuffer);
                        extractedText = pdfData.text
                        
                        console.log(extractedText)
                        // Get all lines and find the first non-empty one
                        const lines = extractedText.split('\n')
                                           .map(line => line.trim())
                                           .filter(line => line.length > 0);
                        
                        // Find first valid line
                        firstLine = '';
                        for (const line of lines) {
                            if (isValidLine(line)) {
                                firstLine = line.substring(0, 100); // Get first 100 characters
                                break;
                            }
                        }

                    } else {
                        const content = await fs.readFile(filePath, 'utf8');
                        const lines = content.split('\n')
                                           .map(line => line.trim())
                                           .filter(line => line.length > 0);
                        // Find first valid line
                        firstLine = '';
                        for (const line of lines) {
                            if (isValidLine(line)) {
                                firstLine = line.substring(0, 100); // Get first 100 characters
                                break;
                            }
                        }

                    }

                    let newFileName;
                    if (firstLine && firstLine.length > 0) {
                        // Create safe filename from first non-empty line
                        newFileName = firstLine
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

                    await fs.copy(filePath, finalNewPath);

                    results.push({
                        originalName: file,
                        newName: newFileName,
                        success: true,
                        noTextFound: !firstLine
                    });
                } catch (err) {
                    // Handle PDF parsing errors (common with scanned PDFs)
                    if (err.message.includes('PDF')) {
                        // If PDF parsing fails, use original filename
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