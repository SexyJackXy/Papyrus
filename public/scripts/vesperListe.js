var cookies = 'dienste_csv'

function containsNumbers(str) {
    return /\d/.test(str);
}

function addNewRow(firstName, lastName) {
    var tableRow = `<tr class="tableRow">
        <td><input type="text" name="forName" value="${firstName}"></td>
        <td><input type="text" name="surrName" value="${lastName}"></td>`

    var newTableRow = `<td>
                        <select name="food">
                            <option>Brötchen</option>
                            <option>Saitenwurst (Paar)</option>
                            <option>Rinderwurst (Stück)</option>
                            <option>Paprikawurst</option>
                            <option>Debreziner</option>
                            <option>Weißwurst</option>
                            <option>Brezel</option>
                            <option>Croissant</option>
                            <option>Natur Frischkäse</option>
                            <option>Marmelade</option>
                            <option>Süßersenf</option>
                            <option>Butter</option>
                        </select>
                    </td>
                    <td><input type="number" name="orderCount"></td>
                </tr>`
    var finalRow = tableRow + newTableRow

    var rows = document.querySelectorAll('.tableRow');
    var lastRow = rows[rows.length - 1];
    lastRow.insertAdjacentHTML('afterend', finalRow)
}

function getContent() {
    var raw = localStorage.getItem(cookies)
    return raw ? JSON.parse(raw) : []
}

async function loadShift(data) {
    var originalNames = []
    var shift = []
    var sortedNames

    data.forEach(element => {
        if (containsNumbers(element.name)) {
            return;
        }
        var fullName = element.name
        var formattedName = fullName.split(", ")
        originalNames.push(formattedName)
        sortedNames = originalNames.sort()
    });

    var res = Array.from(new Set(sortedNames.map(JSON.stringify))).map(JSON.parse);

    res.forEach(name => {
        shift.push({ lastName: name[0], firstName: name[1] })
    })

    shift.forEach(worker => {
        addNewRow(worker.firstName, worker.lastName)
    })
}