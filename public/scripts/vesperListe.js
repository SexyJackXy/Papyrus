var cookies = 'dienste_csv'

function addNewRow() {
    document.addEventListener('DOMContentLoaded', () => {
        var addRowButton = document.getElementById('addTabelRow');
        var newTableRow = `<tr class="tableRow" id='row'>
                                <td><input type="text" name="forName"></td>
                                <td><input type="text" name="surrName"></td>
                                <td>
                                    <select id="food">
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

        addRowButton.addEventListener('click', () => {
            var rows = document.querySelectorAll('.bestellListe .tableRow');
            var lastRow = rows[rows.length - 1];

            lastRow.insertAdjacentHTML('afterend', newTableRow)
        });
    });
}

function getContent() {
    var raw = localStorage.getItem(cookies)
    return raw ? JSON.parse(raw) : []
}

async function loadShift(data) {
    var i = 0
    var originalNames = []

    data.forEach(element => {
        i ++;
        var fullName = element.name
        var formattedName = fullName.split(", ")
        originalNames.push(formattedName)
    });
    originalNames.sort()

    var res = Array.from(new Set(originalNames.map(JSON.stringify))).map(JSON.parse);
    console.log(res)
}

addNewRow();