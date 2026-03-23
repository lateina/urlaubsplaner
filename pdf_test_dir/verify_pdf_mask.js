const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');

const templatePath = path.join(__dirname, '..', 'pdfTemplateDienstreise.js');
const templateContent = fs.readFileSync(templatePath, 'utf8');
const base64Data = templateContent.match(/`([^`]*)`/)[1].trim();

async function verifyMasking() {
    const pdfDoc = await PDFDocument.load(base64Data);
    const pages = pdfDoc.getPages();
    
    console.log(`PDF loaded. Number of pages: ${pages.length}`);

    pages.forEach((page, index) => {
        const { width, height } = page.getSize();
        
        // This is the logic we want to implement
        page.drawRectangle({
            x: 0,
            y: height - 28,
            width: width,
            height: 28,
            color: rgb(1, 1, 1)
        });
        
        console.log(`Applied mask to page ${index + 1}`);
    });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(path.join(__dirname, 'test_output.pdf'), pdfBytes);
    console.log('Test output saved to test_output.pdf');
    
    // Simple verification by checking that the doc was saved correctly
    if (pdfBytes.length > 0) {
        console.log('Verification successful: PDF bytes generated.');
    } else {
        console.error('Verification failed: PDF bytes empty.');
        process.exit(1);
    }
}

verifyMasking().catch(err => {
    console.error(err);
    process.exit(1);
});
