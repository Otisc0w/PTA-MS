// Navbar functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get navbar elements
    const navbar = document.querySelector('.navbar');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navbarTabs = document.querySelector('.tabs');
    
    // Handle mobile menu toggle
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            navbarTabs.classList.toggle('open');
            this.setAttribute('aria-expanded', 
                this.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'
            );
        });
    }
    
    // Add active class to current page link
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.navbar a');
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (linkPath && (linkPath === currentPath || currentPath.startsWith(linkPath + '/'))) {
            link.classList.add('active');
        }
    });
    
    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        if (window.scrollY > 10) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    // Profile dropdown toggle
    function toggleDropdown() {
        document.getElementById("dropdown").classList.toggle("show");
    }
    
    // Assign the dropdown toggle function to global scope for onclick attribute
    window.toggleDropdown = toggleDropdown;
    
    // Close dropdown when clicking outside
    window.addEventListener('click', function(event) {
        if (!event.target.matches('.profile-pic img') && !event.target.matches('.profile-picture')) {
            const dropdowns = document.getElementsByClassName("dropdown-content");
            for (let i = 0; i < dropdowns.length; i++) {
                const openDropdown = dropdowns[i];
                if (openDropdown.classList.contains('show')) {
                    openDropdown.classList.remove('show');
                }
            }
        }
    });
    
    // Add keyboard accessibility
    const dropdownTrigger = document.querySelector('.profile-pic a');
    if (dropdownTrigger) {
        dropdownTrigger.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleDropdown();
            }
        });
        
        // Set proper ARIA attributes
        dropdownTrigger.setAttribute('role', 'button');
        dropdownTrigger.setAttribute('aria-haspopup', 'true');
        dropdownTrigger.setAttribute('aria-expanded', 'false');
        
        // Update aria-expanded when dropdown toggles
        const dropdown = document.getElementById('dropdown');
        if (dropdown) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.attributeName === 'class') {
                        const isExpanded = dropdown.classList.contains('show');
                        dropdownTrigger.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
                    }
                });
            });
            
            observer.observe(dropdown, { attributes: true });
        }
    }
}); 