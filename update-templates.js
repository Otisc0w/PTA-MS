/**
 * Helper script to identify which files need to be updated
 * and provide instructions on what to change.
 */

const fs = require('fs');
const path = require('path');

// Directory containing the views
const viewsDir = path.join(__dirname, 'views');

// Get all .hbs files except those in the partials directory
const getHbsFiles = () => {
  const files = [];
  
  // Read all files in the views directory
  const readDir = (dir) => {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip the partials directory
        if (path.basename(fullPath) !== 'partials') {
          readDir(fullPath);
        }
      } else if (path.extname(fullPath) === '.hbs') {
        files.push(fullPath);
      }
    });
  };
  
  readDir(viewsDir);
  return files;
};

// Check if a file contains the navbar partial
const containsNavbarPartial = (content) => {
  return content.includes('{{> navbar}}');
};

// Check if a file contains the footer partial
const containsFooterPartial = (content) => {
  return content.includes('{{> footer}}');
};

// Check if the file has the required CSS and JS links
const containsRequiredLinks = (content) => {
  const hasFooterCss = content.includes('footer.css');
  const hasFontAwesome = content.includes('font-awesome');
  const hasNavbarJs = content.includes('navbar.js');
  const hasFooterJs = content.includes('footer.js');
  
  return {
    hasFooterCss,
    hasFontAwesome,
    hasNavbarJs,
    hasFooterJs
  };
};

// Generate a report
const generateReport = () => {
  const files = getHbsFiles();
  const report = {
    total: files.length,
    needsUpdate: [],
    fullyUpdated: []
  };
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const hasNavbar = containsNavbarPartial(content);
    const hasFooter = containsFooterPartial(content);
    const linkCheck = containsRequiredLinks(content);
    
    const fileName = path.relative(viewsDir, file);
    
    if (!hasNavbar || !hasFooter || !linkCheck.hasFooterCss || !linkCheck.hasFontAwesome || !linkCheck.hasNavbarJs || !linkCheck.hasFooterJs) {
      report.needsUpdate.push({
        file: fileName,
        missing: {
          navbar: !hasNavbar,
          footer: !hasFooter,
          footerCss: !linkCheck.hasFooterCss,
          fontAwesome: !linkCheck.hasFontAwesome,
          navbarJs: !linkCheck.hasNavbarJs,
          footerJs: !linkCheck.hasFooterJs
        }
      });
    } else {
      report.fullyUpdated.push(fileName);
    }
  });
  
  return report;
};

// Print the report
const report = generateReport();
console.log(`Total template files: ${report.total}`);
console.log(`Files to update: ${report.needsUpdate.length}`);
console.log(`Files already updated: ${report.fullyUpdated.length}`);

console.log('\nFiles needing updates:');
report.needsUpdate.forEach(item => {
  console.log(`\n${item.file}:`);
  if (item.missing.navbar) console.log('  - Missing navbar partial');
  if (item.missing.footer) console.log('  - Missing footer partial');
  if (item.missing.footerCss) console.log('  - Missing footer.css link');
  if (item.missing.fontAwesome) console.log('  - Missing Font Awesome link');
  if (item.missing.navbarJs) console.log('  - Missing navbar.js script');
  if (item.missing.footerJs) console.log('  - Missing footer.js script');
});

console.log('\nFiles already updated:');
console.log(report.fullyUpdated.join(', ')); 