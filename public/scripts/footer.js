// Footer functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get current year for copyright
    const currentYear = new Date().getFullYear();
    const copyrightElement = document.querySelector('.footer .copyright');
    
    if (copyrightElement) {
        copyrightElement.textContent = `© ${currentYear} Philippine Taekwondo Association. All rights reserved.`;
    }
    
    // Make social media links open in new tab
    const socialLinks = document.querySelectorAll('.footer .social-media a');
    socialLinks.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        
        // Add title attribute for accessibility
        const imgAlt = link.querySelector('img').getAttribute('alt');
        link.setAttribute('title', `Visit our ${imgAlt} page`);
    });
}); 