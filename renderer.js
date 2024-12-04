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

    console.log(results)
    if (results.length===0){
        console.log('here')
        const div = document.createElement('div');
        div.className = 'file-item-fail';
        const status = document.createElement('p');
        status.innerHTML = `<strong>Status:</strong> `;
        const statusSpan = document.createElement('span');
        statusSpan.className = 'status-failed';
        statusSpan.textContent = `Failed - Directory is Empty!`; 
        status.append(statusSpan)
        div.appendChild(status)  
        fileList.append(div)
        return 
    }

    results.forEach(result => {
        const div = document.createElement('div');

        try {
            div.className = result.noTextFound ? 'file-item-fail': 'file-item';
        } catch (err) {
            console.log(`Error occured in accesssing 'noTextFound' attribute`);
            div.className = 'file-item-fail'
        }
        const originalName = document.createElement('p');
        originalName.innerHTML = `<strong>Original:</strong> ${result.originalName}`;
        div.appendChild(originalName);

        if (result.success) {
            const newName = document.createElement('p');
            newName.innerHTML = `<strong>New name:</strong> ${result.newName}`;
            div.appendChild(newName);

            const status = document.createElement('p');
            status.innerHTML = `<strong>Status:</strong> `;
            const statusSpan = document.createElement('span');
            statusSpan.className = result.noTextFound ? 'status-warning' : 'status-success';
            statusSpan.textContent = result.noTextFound
                ? 'No readable text found - Original filename kept'
                : 'Success';
            status.appendChild(statusSpan);
            div.appendChild(status);
        } else {
            div.className = 'file-item-fail'
            const status = document.createElement('p');
            status.innerHTML = `<strong>Status:</strong> `;
            const statusSpan = document.createElement('span');
            statusSpan.className = 'status-failed';
            statusSpan.textContent = `Failed - ${result.error}`;
            status.appendChild(statusSpan);
            div.appendChild(status);
        }
        
        fileList.appendChild(div);
    });
}