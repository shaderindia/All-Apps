/* Preview zoom never changes the physical report or the export dimensions. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const find = id => document.getElementById(id);
    const modal = find('report-preview-modal');
    const page = find('report-preview-content');
    const stage = find('report-stage');
    const scroller = find('report-scrollable-content');
    const paper = find('report-paper-size');
    const zoomLabel = find('zoom-level');
    const main = document.querySelector('main');
    let zoom = 1, mode = 'page', busy = false, previousFocus, previousOverflow, previousInert;
    const isOpen = () => !modal.classList.contains('hidden');
    const size = () => paper.value === 'landscape' ? { width: 297, height: 210 } : { width: 210, height: 297 };
    const pixels = () => { const { width, height } = size(); return { width: width * 96 / 25.4, height: height * 96 / 25.4 }; };

    function createSalaryWorkbook() {
      const monthKey = getMonthKey();
      const [yearText, monthText] = monthKey.split('-');
      const year = Number(yearText), month = Number(monthText);
      const salary = Math.max(0, parseFloat(find('salary').value) || 0);
      const baseHours = Math.max(0, parseFloat(find('fixedBaseHours').value) || 0);
      const hourlyRate = baseHours > 0 ? salary / baseHours : 0;
      const weekendRate = Math.max(0, parseFloat(find('weekendRate').value) || 1);
      const nightRate = Math.max(0, parseFloat(find('nightRate').value) || 1);
      const cShiftRate = Math.max(0, parseFloat(find('cShiftRate').value) || 1);
      const exchangeRate = Math.max(0, parseFloat(find('exchange-rate-manual').value) || 0);
      const dailyLeft = [], dailyRight = [], dailyData = [];
      let weekdayHours = 0, weekendHours = 0, nightHours = 0, cShiftHours = 0, daysWorked = 0, grossSalary = 0;
      const daysInMonth = new Date(year, month, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const hoursSelect = find(`hours-${day}`);
        const shiftSelect = find(`shift-${day}`);
        const hours = Math.max(0, parseFloat(hoursSelect?.value) || 0);
        const weekend = hoursSelect?.dataset.isWeekend === 'true';
        const shift = shiftSelect?.value || '';
        const night = shift.toLowerCase() === 'night';
        const cShift = shift.toLowerCase() === 'c';
        const weekendMultiplier = weekend ? weekendRate : 1;
        const nightMultiplier = night ? nightRate : 1;
        const cShiftMultiplier = cShift ? cShiftRate : 1;
        const multiplier = weekendMultiplier * nightMultiplier * cShiftMultiplier;
        const dailyPay = hours * hourlyRate * multiplier;
        const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
        const shiftText = shiftSelect?.options[shiftSelect.selectedIndex]?.text || 'N/A';
        const dateText = `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} (${date.toLocaleDateString('en-GB', { weekday: 'short' })}) - ${shiftText}`;

        if (weekend) weekendHours += hours; else weekdayHours += hours;
        if (night) nightHours += hours;
        if (cShift) cShiftHours += hours;
        if (hours > 0) daysWorked++;
        grossSalary += dailyPay;
        (day <= Math.ceil(daysInMonth / 2) ? dailyLeft : dailyRight).push({ dateText, hours, dailyPay, weekend });
        dailyData.push({
          dateSerial: Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000),
          weekday, shift: shiftText, dayType: weekend ? 'Weekend' : 'Weekday', hours, hourlyRate,
          weekendMultiplier, nightMultiplier, cShiftMultiplier, effectiveRate: hourlyRate * multiplier, dailyPay
        });
      }

      const totalHours = weekdayHours + weekendHours;
      const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
      const generatedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const formatHours = value => formatNumber(value, value % 1 ? 1 : 0);
      const cell = (value, style = 0) => ({ value, style });
      const formulaCell = (value, style, formula) => ({ value, style, formula });
      const blankRow = () => Array(6).fill(null);
      const rows = [
        [cell(find('company-name').value.trim(), 1)],
        [cell('Salary Statement', 2)],
        [cell(`For Period: ${monthName} ${year} • Generated on ${generatedDate}`, 3)],
        blankRow(),
        [cell('Employee:', 4), cell(find('employee-name-input').value.trim(), 5), null, cell('Total Hours Worked:', 4), cell(totalHours, 7), cell('hrs', 8)],
        [cell('Base Salary:', 4), cell(salary, 6), cell('RON', 8), cell('Breakdown:', 4), cell(`Weekday: ${formatHours(weekdayHours)}h | Weekend: ${formatHours(weekendHours)}h | Night: ${formatHours(nightHours)}h | C shift: ${formatHours(cShiftHours)}h`, 5)],
        [cell('Fixed Base Hours:', 4), cell(baseHours, 7), cell('hrs', 8), cell('Days Worked / Days Off:', 4), cell(`${daysWorked} / ${daysInMonth - daysWorked}`, 5)],
        [cell('Standard Hourly Rate:', 4), cell(hourlyRate, 6), cell('RON/hr', 8), cell('Total Gross Salary:', 4), cell(grossSalary, 6), cell('RON', 8)],
        [cell('Multipliers:', 4), cell(`Weekend: ${weekendRate}x | Night: ${nightRate}x | C Shift: ${cShiftRate}x`, 5), null, cell('Converted Value (INR):', 4), cell(grossSalary * exchangeRate, 6), cell('INR', 8)],
        blankRow(),
        [cell('Itemized Daily Work Log', 16)],
        ['Date & Shift', 'Hours', 'Daily Pay', 'Date & Shift', 'Hours', 'Daily Pay'].map(value => cell(value, 12))
      ];
      const maxDailyRows = Math.max(dailyLeft.length, dailyRight.length);
      for (let index = 0; index < maxDailyRows; index++) {
        const left = dailyLeft[index], right = dailyRight[index];
        const dailyCells = (item) => item ? [
          cell(item.dateText, item.weekend ? 13 : 9),
          cell(item.hours, item.weekend ? 14 : 10),
          cell(item.dailyPay, item.weekend ? 15 : 11)
        ] : [null, null, null];
        rows.push([...dailyCells(left), ...dailyCells(right)]);
      }
      const signatureRow = rows.length + 1;
      rows.push([cell('Employee Signature: _________________________', 17), null, null, cell('Authorized Signature: _________________________', 17)]);
      rows.push([cell('Date: ____________________', 17), null, null, cell('Date: ____________________', 17)]);
      rows.push([cell('Generated with SHADER7 • Monthly salary and work log', 18)]);
      const merges = ['A1:F1', 'A2:F2', 'A3:F3', 'A11:F11', 'B5:C5', 'E6:F6', 'E7:F7', 'B9:C9', `A${signatureRow}:C${signatureRow}`, `D${signatureRow}:F${signatureRow}`, `A${signatureRow + 1}:C${signatureRow + 1}`, `D${signatureRow + 1}:F${signatureRow + 1}`, `A${signatureRow + 2}:F${signatureRow + 2}`];
      const dataRows = [[
        'Date', 'Weekday', 'Shift', 'Day Type', 'Hours', 'Base Hourly Rate (RON)',
        'Weekend Multiplier', 'Night Multiplier', 'C Shift Multiplier', 'Effective Rate (RON/hr)', 'Daily Pay (RON)'
      ].map(value => cell(value, 12))];
      dailyData.forEach((item, index) => {
        const excelRow = index + 2;
        dataRows.push([
          cell(item.dateSerial, 19), cell(item.weekday, 9), cell(item.shift, 9), cell(item.dayType, 9),
          cell(item.hours, 10), cell(item.hourlyRate, 6), cell(item.weekendMultiplier, 7), cell(item.nightMultiplier, 7),
          cell(item.cShiftMultiplier, 7), formulaCell(item.effectiveRate, 6, `F${excelRow}*G${excelRow}*H${excelRow}*I${excelRow}`),
          formulaCell(item.dailyPay, 11, `E${excelRow}*J${excelRow}`)
        ]);
      });
      dataRows.push(blankRow().concat(Array(5).fill(null)));
      const dataTotalRow = dataRows.length + 1;
      dataRows.push([
        cell('Monthly Total', 16), null, null, null,
        formulaCell(totalHours, 10, `SUM(E2:E${dailyData.length + 1})`), null, null, null, null, null,
        formulaCell(grossSalary, 11, `SUM(K2:K${dailyData.length + 1})`)
      ]);

      const xmlEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
      const columnName = index => {
        let name = '';
        while (index > 0) { index--; name = String.fromCharCode(65 + index % 26) + name; index = Math.floor(index / 26); }
        return name;
      };
      const worksheetXml = (rows, widths, mergeRefs = [], filterRef = '', layout = 'data') => {
        const rowXml = rows.map((row, rowIndex) => {
          const cells = row.map((item, columnIndex) => {
            if (item === null || item === undefined) return '';
            const value = item.value;
            if (value === '' || value === null || value === undefined) return '';
            const ref = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
            const style = item.style ? ` s="${item.style}"` : '';
            if (item.formula) return `<c r="${ref}"${style}><f>${xmlEscape(item.formula)}</f><v>${value}</v></c>`;
            if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
            return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
          }).join('');
          const excelRow = rowIndex + 1;
          const height = layout === 'report'
            ? excelRow === 1 ? 30 : excelRow === 2 ? 24 : excelRow === 3 ? 22 : excelRow >= 5 && excelRow <= 9 ? 30 : excelRow === 12 ? 26 : excelRow >= 13 && excelRow < signatureRow ? 24 : 21
            : excelRow === 1 ? 30 : excelRow === dataTotalRow ? 24 : 20;
          return `<row r="${excelRow}" ht="${height}" customHeight="1">${cells}</row>`;
        }).join('');
        const columnWidths = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
        const mergedCells = mergeRefs.map(ref => `<mergeCell ref="${ref}"/>`).join('');
        const finalColumn = columnName(widths.length);
        const sheetProperties = layout === 'report' ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : '';
        const sheetView = layout === 'report'
          ? '<sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>'
          : '<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
        const filter = filterRef ? `<autoFilter ref="${filterRef}"/>` : '';
        const mergeXml = mergeRefs.length ? `<mergeCells count="${mergeRefs.length}">${mergedCells}</mergeCells>` : '';
        const printSettings = layout === 'report'
          ? `<printOptions horizontalCentered="1"/><pageMargins left="0.39" right="0.39" top="0.39" bottom="0.39" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="${paper.value}" fitToWidth="1" fitToHeight="1"/>`
          : '';
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sheetProperties}<dimension ref="A1:${finalColumn}${rows.length}"/>${sheetView}<sheetFormatPr defaultRowHeight="15"/><cols>${columnWidths}</cols><sheetData>${rowXml}</sheetData>${filter}${mergeXml}${printSettings}</worksheet>`;
      };

      const files = [
        ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
        ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
        ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Salary Report" sheetId="1" r:id="rId1"/><sheet name="Daily Data" sheetId="2" r:id="rId2"/></sheets><calcPr calcMode="auto" fullCalcOnLoad="1"/></workbook>'],
        ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
        ['xl/worksheets/sheet1.xml', worksheetXml(rows, [25, 10, 15, 25, 10, 15], merges, '', 'report')],
        ['xl/worksheets/sheet2.xml', worksheetXml(dataRows, [14, 13, 16, 13, 10, 23, 15, 15, 15, 24, 18], [], `A1:K${dailyData.length + 1}`)],
        ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="4"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="#,##0.##"/><numFmt numFmtId="166" formatCode="#,##0.00&quot; RON&quot;"/><numFmt numFmtId="167" formatCode="#,##0.##&quot;h&quot;"/></numFmts><fonts count="6"><font><name val="Calibri"/><sz val="10"/><color rgb="FF182338"/></font><font><name val="Calibri"/><b/><sz val="16"/><color rgb="FF172C4B"/></font><font><name val="Calibri"/><b/><sz val="12"/><color rgb="FF355DD1"/></font><font><name val="Calibri"/><sz val="9"/><color rgb="FF526176"/></font><font><name val="Calibri"/><b/><sz val="9"/><color rgb="FF172C4B"/></font><font><name val="Calibri"/><sz val="8"/><color rgb="FF66748A"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF0F8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F6FA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7F7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD4DCE7"/></left><right style="thin"><color rgb="FFD4DCE7"/></right><top style="thin"><color rgb="FFD4DCE7"/></top><bottom style="thin"><color rgb="FFD4DCE7"/></bottom><diagonal/></border><border><left/><right/><top/><bottom style="medium"><color rgb="FF355DD1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="19"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="165" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']
      ];
      const stylesFile = files.find(([path]) => path === 'xl/styles.xml');
      stylesFile[1] = stylesFile[1]
        .replace('<xf numFmtId="165" fontId="0" fillId="0" borderId="1"', '<xf numFmtId="167" fontId="0" fillId="0" borderId="1"')
        .replace('<xf numFmtId="164" fontId="0" fillId="0" borderId="1"', '<xf numFmtId="166" fontId="0" fillId="0" borderId="1"')
        .replace('<xf numFmtId="165" fontId="0" fillId="4" borderId="1"', '<xf numFmtId="167" fontId="0" fillId="4" borderId="1"')
        .replace('<xf numFmtId="164" fontId="0" fillId="4" borderId="1"', '<xf numFmtId="166" fontId="0" fillId="4" borderId="1"')
        .replace('<numFmts count="4">', '<numFmts count="5">')
        .replace('</numFmts>', '<numFmt numFmtId="168" formatCode="dd mmm yyyy"/></numFmts>')
        .replace('<cellXfs count="19">', '<cellXfs count="20">')
        .replace('<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs>', '<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="168" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs>');

      const encoder = new TextEncoder();
      const crcTable = Array.from({ length: 256 }, (_, number) => {
        let value = number;
        for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
        return value >>> 0;
      });
      const crc32 = bytes => {
        let crc = 0xFFFFFFFF;
        for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
      };
      const localParts = [], centralParts = [];
      let offset = 0;
      const now = new Date();
      const zipTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
      const zipDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
      const makeHeader = (length, fields) => {
        const bytes = new Uint8Array(length), view = new DataView(bytes.buffer);
        fields.forEach(([index, value, width]) => width === 2 ? view.setUint16(index, value, true) : view.setUint32(index, value, true));
        return bytes;
      };

      for (const [path, content] of files) {
        const name = encoder.encode(path), data = encoder.encode(content), checksum = crc32(data);
        const localHeader = makeHeader(30, [[0, 0x04034B50, 4], [4, 20, 2], [6, 0, 2], [8, 0, 2], [10, zipTime, 2], [12, zipDate, 2], [14, checksum, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]]);
        localParts.push(localHeader, name, data);
        const centralHeader = makeHeader(46, [[0, 0x02014B50, 4], [4, 20, 2], [6, 20, 2], [8, 0, 2], [10, 0, 2], [12, zipTime, 2], [14, zipDate, 2], [16, checksum, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]);
        centralParts.push(centralHeader, name);
        offset += localHeader.length + name.length + data.length;
      }
      const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
      const endRecord = makeHeader(22, [[0, 0x06054B50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, centralSize, 4], [16, offset, 4], [20, 0, 2]]);
      return new Blob([...localParts, ...centralParts, endRecord], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    function fittedZoom(view) {
      const bounds = pixels();
      const style = getComputedStyle(scroller);
      const width = scroller.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = scroller.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      return Math.min(1, view === 'width' ? width / bounds.width : Math.min(width / bounds.width, height / bounds.height));
    }

    function setZoom(value, view = 'custom', anchor) {
      const bounds = pixels();
      const oldZoom = zoom;
      const point = anchor || { x: scroller.clientWidth / 2, y: scroller.clientHeight / 2 };
      const oldRect = stage.getBoundingClientRect();
      const scrollRect = scroller.getBoundingClientRect();
      const documentX = (scrollRect.left + point.x - oldRect.left) / oldZoom;
      const documentY = (scrollRect.top + point.y - oldRect.top) / oldZoom;
      zoom = Math.min(3, Math.max(view === 'custom' ? 0.2 : 0.05, value));
      mode = view;
      stage.style.width = `${bounds.width * zoom}px`;
      stage.style.height = `${bounds.height * zoom}px`;
      page.style.transform = `scale(${zoom})`;
      zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
      find('zoom-fit-btn').setAttribute('aria-pressed', String(view === 'page'));
      find('zoom-width-btn').setAttribute('aria-pressed', String(view === 'width'));
      find('zoom-actual-btn').setAttribute('aria-pressed', String(view === 'actual'));
      find('zoom-out-btn').disabled = zoom <= 0.2;
      find('zoom-in-btn').disabled = zoom >= 3;
      if (view === 'page' || view === 'width') scroller.scrollTo(0, 0);
      else {
        const newRect = stage.getBoundingClientRect();
        scroller.scrollLeft += newRect.left + documentX * zoom - scrollRect.left - point.x;
        scroller.scrollTop += newRect.top + documentY * zoom - scrollRect.top - point.y;
      }
    }
    const fit = view => setZoom(fittedZoom(view), view);

    function arrangePaper() {
      page.dataset.orientation = paper.value;
      const inner = page.querySelector('.report-sheet-inner');
      inner.style.transform = '';
      inner.style.minHeight = '100%';
      // Compress unusually long names or wrapped numbers as a whole, without clipping rows.
      const style = getComputedStyle(page);
      const available = pixels().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const natural = inner.scrollHeight;
      const scale = natural > available + 1 ? available / natural : 1;
      if (scale < 1) inner.style.transform = `scale(${scale})`;
      const { width, height } = size();
      find('report-page-details').textContent = `A4 ${paper.value} · ${width} × ${height} mm · 1 page`;
      find('report-layout-note').textContent = scale < 0.85 ? 'Content reduced to fit A4. Try the other orientation for a larger layout.' : 'Preview and downloads use the same A4 layout. Print at 100% or Actual size.';
      find('report-print-page').textContent = `@page { size: A4 ${paper.value}; margin: 0; }`;
      fit(mode === 'width' ? 'width' : 'page');
    }

    function open() {
      const message = validateReportInputs();
      if (message) return showToast(message);
      const hasHours = Array.from(document.querySelectorAll('.hours-select')).some(select => Number(select.value) > 0);
      if (!hasHours && !confirm('No hours have been entered. Generate a report anyway?')) return;
      previousFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      previousInert = main.hasAttribute('inert');
      page.innerHTML = `<div class="report-sheet-inner">${generateReportHTML()}</div>`;
      modal.classList.remove('hidden');
      document.body.classList.add('salary-report-open');
      document.body.style.overflow = 'hidden';
      main.setAttribute('inert', '');
      mode = 'page';
      arrangePaper();
      find('modal-close-btn').focus({ preventScroll: true });
      document.fonts.ready.then(() => { if (isOpen()) arrangePaper(); });
    }

    function close() {
      if (busy) return;
      modal.classList.add('hidden');
      document.body.classList.remove('salary-report-open');
      document.body.style.overflow = previousOverflow;
      if (!previousInert) main.removeAttribute('inert');
      previousFocus?.focus({ preventScroll: true });
    }

    async function download(format) {
      if (busy) return;
      if (format !== 'xlsx' && (!window.html2canvas || (format === 'pdf' && !window.jspdf?.jsPDF))) return showToast('Report tools are loading. Please try again in a moment.');
      busy = true;
      modal.setAttribute('aria-busy', 'true');
      const controls = Array.from(modal.querySelectorAll('button, select'));
      const disabled = controls.map(control => control.disabled);
      controls.forEach(control => { control.disabled = true; });
      const button = find(`modal-download-${format}-btn`);
      const label = button.innerHTML;
      button.textContent = format === 'xlsx' ? 'Creating Excel…' : `Creating ${format.toUpperCase()}…`;
      try {
        const safe = value => value.trim().replace(/[^a-z0-9_-]+/gi, '_').slice(0, 70) || 'Report';
        const filename = `Salary_Report_${safe(find('employee-name-input').value)}_${getMonthKey()}`;
        if (format === 'xlsx') {
          const url = URL.createObjectURL(createSalaryWorkbook());
          const link = document.createElement('a');
          link.download = `${filename}.xlsx`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          showToast('Excel workbook downloaded.');
        } else {
          await document.fonts.ready;
          const bounds = pixels();
          const canvas = await html2canvas(page, {
            scale: 3, backgroundColor: '#ffffff', logging: false, useCORS: true,
            width: bounds.width, height: bounds.height, windowWidth: Math.ceil(bounds.width), windowHeight: Math.ceil(bounds.height),
            scrollX: 0, scrollY: 0,
            onclone(doc) {
              const copy = doc.getElementById('report-preview-content');
              doc.body.appendChild(copy);
              copy.style.cssText = 'position:absolute;left:0;top:0;transform:none;margin:0;box-shadow:none;';
            }
          });
          if (format === 'pdf') {
            const pdf = new window.jspdf.jsPDF({ orientation: paper.value, unit: 'mm', format: 'a4', compress: true });
            pdf.addImage(canvas, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            pdf.save(`${filename}_A4_${paper.value}.pdf`);
          } else {
            const link = document.createElement('a');
            link.download = `${filename}_A4_${paper.value}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            document.body.appendChild(link);
            link.click();
            link.remove();
          }
          showToast(`${format.toUpperCase()} report downloaded.`);
        }
      } catch (error) {
        console.error('Salary report export failed:', error);
        showToast(format === 'xlsx' ? 'Could not create the Excel file. Please try again.' : 'Could not download the report. Please try again.');
      } finally {
        busy = false;
        modal.removeAttribute('aria-busy');
        controls.forEach((control, index) => { control.disabled = disabled[index]; });
        button.innerHTML = label;
        button.focus({ preventScroll: true });
      }
    }

    find('report-btn').addEventListener('click', open);
    find('modal-close-btn').addEventListener('click', close);
    paper.addEventListener('change', arrangePaper);
    find('zoom-fit-btn').addEventListener('click', () => fit('page'));
    find('zoom-width-btn').addEventListener('click', () => fit('width'));
    find('zoom-actual-btn').addEventListener('click', () => setZoom(1, 'actual'));
    find('zoom-out-btn').addEventListener('click', () => setZoom(zoom - 0.1));
    find('zoom-in-btn').addEventListener('click', () => setZoom(zoom + 0.1));
    find('modal-download-pdf-btn').addEventListener('click', () => download('pdf'));
    find('modal-download-jpg-btn').addEventListener('click', () => download('jpg'));
    find('modal-download-xlsx-btn').addEventListener('click', () => download('xlsx'));
    find('modal-print-btn').addEventListener('click', () => window.print());
    new ResizeObserver(() => { if (isOpen() && (mode === 'page' || mode === 'width')) fit(mode); }).observe(scroller);

    document.addEventListener('keydown', event => {
      if (!isOpen()) return;
      if (busy) { if (event.key === 'Tab' || event.key === 'Escape') event.preventDefault(); return; }
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key === 'Tab') {
        const focusable = Array.from(modal.querySelectorAll('button:not(:disabled), select:not(:disabled), [tabindex="0"]'));
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') { event.preventDefault(); window.print(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
      if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoom + 0.1); }
      if (event.key === '-') { event.preventDefault(); setZoom(zoom - 0.1); }
      if (event.key === '0') { event.preventDefault(); fit('page'); }
    });

    let pinch;
    scroller.addEventListener('touchstart', event => {
      if (event.touches.length !== 2 || busy) return;
      event.preventDefault();
      pinch = { distance: Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY), zoom };
    }, { passive: false });
    scroller.addEventListener('touchmove', event => {
      if (!pinch || event.touches.length !== 2 || busy) return;
      event.preventDefault();
      const [a, b] = event.touches, rect = scroller.getBoundingClientRect();
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch.distance) setZoom(pinch.zoom * distance / pinch.distance, 'custom', { x: (a.clientX + b.clientX) / 2 - rect.left, y: (a.clientY + b.clientY) / 2 - rect.top });
    }, { passive: false });
    scroller.addEventListener('touchend', () => { pinch = null; });
    scroller.addEventListener('touchcancel', () => { pinch = null; });
  });
})();
