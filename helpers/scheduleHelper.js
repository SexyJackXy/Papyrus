var fs = require('fs')
var path = require('path')

function readSchedule() {
    var currentPath = path.join(__dirname, '..', 'dailySchedule', 'current.json')
    if (!fs.existsSync(currentPath)) return null;
    return JSON.parse(fs.readFileSync(currentPath, 'utf-8'))
}

function formatCurrentJson() {
    var currentJson = readSchedule()
    if (!currentJson) return;

    currentJson.forEach(line => {
        if (line.present === null) {
            line.present = 'true'
        }
    });

    var currentPath = path.join(__dirname, '..', 'dailySchedule', 'current.json')
    fs.writeFileSync(
        currentPath,
        JSON.stringify(currentJson, null, 2),
        'utf-8'
    );

    removeFreeFromSchedule()
    console.log('current.json wurde aktualisiert!')
}

function removeFreeFromSchedule() {
    var currentJson = readSchedule()
    if (!currentJson) return;

    var filtered = currentJson.filter(line => !(line.role === 'Frei' && line.name === 'Frei'))

    var currentPath = path.join(__dirname, '..', 'dailySchedule', 'current.json')
    fs.writeFileSync(
        currentPath,
        JSON.stringify(filtered, null, 2),
        'utf-8'
    );

    console.log('Frei-Einträge wurden entfernt!')
}


formatCurrentJson()