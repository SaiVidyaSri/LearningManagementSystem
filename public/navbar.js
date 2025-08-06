// Modern Navbar JavaScript
class ModernNavbar {
    constructor() {
        this.currentUser = null;
        this.isDropdownOpen = false;
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.setActiveNavItem();
    }

    checkAuth() {
        // Try both 'user' and 'userData' keys for compatibility
        const user = localStorage.getItem('userData') || localStorage.getItem('user');
        const token = localStorage.getItem('token');
        
        if (!user || !token) {
            // Only redirect if we're not on public pages
            const currentPage = window.location.pathname.split('/').pop();
            const publicPages = ['index.html', 'login.html', 'register.html', 'about.html', 'contact.html', 'forgot-password.html', ''];
            
            if (!publicPages.includes(currentPage)) {
                window.location.href = 'login.html';
                return;
            }
        } else {
            this.currentUser = JSON.parse(user);
            this.renderNavbar();
        }
    }

    getNavItems(role) {
        if (role === 'instructor') {
            return [
                { text: 'Dashboard', href: 'instructor-dashboard.html' },
                { text: 'My Courses', href: 'instructor-courses.html' },
                { text: 'Create Course', href: 'instructor-create-course.html' },
                { text: 'Students', href: 'instructor-students.html' },
                { text: 'Q&A', href: 'instructor-queries.html' },
                { text: 'Analytics', href: 'instructor-analytics.html' }
            ];
        } else if (role === 'student') {
            return [
                { text: 'Dashboard', href: 'student-dashboard.html' },
                { text: 'Browse Courses', href: 'courses.html' },
                { text: 'My Courses', href: 'my-courses.html' },
                { text: 'Progress', href: 'progress.html' },
                { text: 'Q&A', href: 'queries.html' },
                { text: 'Certificates', href: 'certificates.html' }
            ];
        } else {
            // Admin or default
            return [
                { text: 'Dashboard', href: 'admin-dashboard.html' },
                { text: 'Users', href: 'admin-users.html' },
                { text: 'Courses', href: 'admin-courses.html' },
                { text: 'Instructors', href: 'admin-instructors.html' },
                { text: 'Reports', href: 'admin-reports.html' }
            ];
        }
    }

    getProfileMenuItems(role) {
        let navigationLinks = [];
        
        if (role === 'instructor') {
            navigationLinks = [
                { text: 'Dashboard', href: 'instructor-dashboard.html', icon: '🏠' },
                { text: 'My Courses', href: 'instructor-courses.html', icon: '📚' },
                { text: 'Create Course', href: 'instructor-create-course.html', icon: '➕' },
                { text: 'Students', href: 'instructor-students.html', icon: '👥' },
                { text: 'Q&A', href: 'instructor-queries.html', icon: '❓' },
                { text: 'Analytics', href: 'instructor-analytics.html', icon: '📊' }
            ];
        } else if (role === 'student') {
            navigationLinks = [
                { text: 'Dashboard', href: 'student-dashboard.html', icon: '🏠' },
                { text: 'Browse Courses', href: 'courses.html', icon: '📚' },
                { text: 'My Courses', href: 'my-courses.html', icon: '📖' },
                { text: 'Progress', href: 'progress.html', icon: '📊' },
                { text: 'Q&A', href: 'queries.html', icon: '❓' },
                { text: 'Certificates', href: 'certificates.html', icon: '🏆' }
            ];
        } else {
            // Admin navigation
            navigationLinks = [
                { text: 'Dashboard', href: 'admin-dashboard.html', icon: '🏠' },
                { text: 'Users', href: 'admin-users.html', icon: '👥' },
                { text: 'Courses', href: 'admin-courses.html', icon: '📚' },
                { text: 'Instructors', href: 'admin-instructors.html', icon: '👨‍🏫' },
                { text: 'Reports', href: 'admin-reports.html', icon: '📊' }
            ];
        }

        // Profile specific items
        const profileItems = [
            { text: 'My Profile', href: role === 'instructor' ? 'instructor-profile.html' : 'profile.html', icon: '👤' },
            { text: 'Settings', href: role === 'instructor' ? 'instructor-profile.html' : 'profile.html', icon: '⚙️' },
            { text: 'Logout', action: 'logout', icon: '🚪', class: 'logout' }
        ];

        // Combine navigation and profile items with a separator
        return [...navigationLinks, { separator: true }, ...profileItems];
    }

    getUserInitials() {
        if (!this.currentUser) return 'U';
        
        const name = this.currentUser.fullName || this.currentUser.name || this.currentUser.username || this.currentUser.email;
        const words = name.trim().split(' ');
        
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        } else {
            return words[0][0].toUpperCase();
        }
    }

    renderNavbar() {
        if (!this.currentUser) return;

        const navItems = this.getNavItems(this.currentUser.role);
        const profileMenuItems = this.getProfileMenuItems(this.currentUser.role);
        const userInitials = this.getUserInitials();

        console.log('Rendering navbar for user:', this.currentUser.name || this.currentUser.fullName);

        const navbarHTML = `
            <nav class="modern-navbar">
                <div class="navbar-container">
                    <!-- Brand -->
                    <a href="${this.currentUser.role === 'admin' ? 'admin-dashboard.html' : (this.currentUser.role === 'instructor' ? 'instructor-dashboard.html' : 'student-dashboard.html')}" class="navbar-brand">
                        <div class="navbar-logo">📚</div>
                        Learnova
                    </a>

                    <!-- Center Navigation -->
                    <div class="navbar-center">
                        <ul class="navbar-nav">
                            ${navItems.map(item => `
                                <li><a href="${item.href}">${item.text}</a></li>
                            `).join('')}
                        </ul>
                    </div>

                    <!-- Profile Dropdown -->
                    <div class="navbar-profile">
                        <button class="profile-btn" id="profileBtn" type="button">
                            ${userInitials}
                        </button>
                        <div class="profile-dropdown" id="profileDropdown">
                            <div class="profile-header">
                                <div class="profile-avatar">
                                    ${userInitials}
                                </div>
                                <div class="profile-name">${this.currentUser.fullName || this.currentUser.name || this.currentUser.username}</div>
                                <div class="profile-email">${this.currentUser.email}</div>
                                <div class="profile-role">${this.currentUser.role.charAt(0).toUpperCase() + this.currentUser.role.slice(1)}</div>
                            </div>
                            <div class="profile-menu">
                                ${profileMenuItems.map(item => {
                                    if (item.separator) {
                                        return '<div class="profile-menu-separator"></div>';
                                    }
                                    return `
                                        <a href="${item.href || '#'}" 
                                           class="profile-menu-item ${item.class || ''}" 
                                           ${item.action ? `onclick="navbar.${item.action}(); return false;"` : ''}>
                                            ${item.icon} ${item.text}
                                        </a>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        `;

        // Insert navbar at the beginning of body or replace existing navbar
        const existingNavbar = document.querySelector('.modern-navbar');
        if (existingNavbar) {
            existingNavbar.outerHTML = navbarHTML;
        } else {
            document.body.insertAdjacentHTML('afterbegin', navbarHTML);
        }

        // Re-setup event listeners after rendering
        console.log('Setting up event listeners...');
        this.setupEventListeners();
        this.setActiveNavItem();
    }

    setupEventListeners() {
        // Profile dropdown toggle
        const profileBtn = document.getElementById('profileBtn');
        const profileDropdown = document.getElementById('profileDropdown');

        if (profileBtn && profileDropdown) {
            // Remove any existing listeners
            profileBtn.removeEventListener('click', this.handleProfileClick);
            
            // Store bound function reference
            this.handleProfileClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Profile button clicked');
                this.toggleDropdown();
            };
            
            profileBtn.addEventListener('click', this.handleProfileClick);

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
                    this.closeDropdown();
                }
            });

            // Prevent dropdown from closing when clicking inside
            profileDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        } else {
            console.error('Profile button or dropdown not found');
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDropdown();
            }
        });
    }

    setActiveNavItem() {
        const currentPage = window.location.pathname.split('/').pop();
        const navLinks = document.querySelectorAll('.navbar-nav a');
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            const linkPage = link.getAttribute('href');
            if (linkPage === currentPage) {
                link.classList.add('active');
            }
        });
    }

    toggleDropdown() {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) {
            this.isDropdownOpen = !this.isDropdownOpen;
            console.log('Toggling dropdown, isOpen:', this.isDropdownOpen);
            
            if (this.isDropdownOpen) {
                dropdown.classList.add('show');
            } else {
                dropdown.classList.remove('show');
            }
        } else {
            console.error('Dropdown element not found');
        }
    }

    closeDropdown() {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) {
            this.isDropdownOpen = false;
            dropdown.classList.remove('show');
        }
    }

    logout() {
        localStorage.removeItem('user');
        localStorage.removeItem('userData');
        localStorage.removeItem('token');
        alert('You have been logged out successfully');
        window.location.href = 'login.html';
    }
}

// Initialize navbar when DOM is loaded
let navbar;
document.addEventListener('DOMContentLoaded', () => {
    navbar = new ModernNavbar();
});

// Make navbar available globally
window.navbar = navbar;
