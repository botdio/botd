var spawn = require('child_process').spawn;

exports.cp = function *(src, dest) {
    return new Promise((resolve, reject) => {
        spawn('docker', ['cp', src, dest])
        .on(`exit`,exitCode => {
            if(exitCode === 0) resolve();
            else reject(`fail to cp ${src} to ${dest}, exit code ${exitCode}`);
        });  
    });
}