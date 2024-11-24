const { ipcRenderer } = require('electron');

let selectedDirectory = '';

document.getElementById('selectDir').addEventListener('click', async () => {
    const paths = await ipcRenderer.invoke('select-directory');
    if (paths && paths.length > 0) {
        selectedDirectory = paths[0];
        document.getElementById('fileList').innerHTML = `Selected directory: ${selectedDirectory}`;
    }
});

document.getElementById('processFiles').addEventListener('click', async () => {
    if (!selectedDirectory) {
        alert('Please select a directory first');
        return;
    }

    try {
        const results = await ipcRenderer.invoke('process-files', selectedDirectory);
        displayResults(results);
    } catch (err) {
        alert('Error processing files: ' + err.message);
    }
});

function displayResults(results) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '<h3>Processing Results:</h3>';

    results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'file-item';
        
        if (result.success) {
            let status = 'Success';
            if (result.noTextFound) {
                status = 'No readable text found - Original filename kept';
            }
            
            div.innerHTML = `
                Original: ${result.originalName}<br>
                New name: ${result.newName}<br>
                Status: ${status}
            `;
        } else {
            div.innerHTML = `
                Original: ${result.originalName}<br>
                Status: Failed - ${result.error}
            `;
        }

        fileList.appendChild(div);
    });
}