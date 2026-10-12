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

addNewRow();