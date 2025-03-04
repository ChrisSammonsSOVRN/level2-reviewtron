// Website Auditor Frontend JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // API Base URL
    const API_BASE_URL = 'http://localhost:5000';
    
    // Navigation
    setupNavigation();
    
    // Initialize pages
    initDashboard();
    initAuditPage();
    initHistoryPage();
    initStatsPage();
    
    // Setup modal
    setupModal();
    
    /**
     * Navigation Setup
     */
    function setupNavigation() {
        const navLinks = document.querySelectorAll('nav a');
        
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Remove active class from all links and pages
                navLinks.forEach(l => l.classList.remove('active'));
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                
                // Add active class to clicked link
                this.classList.add('active');
                
                // Show the corresponding page
                const pageId = this.getAttribute('data-page');
                document.getElementById(pageId).classList.add('active');
            });
        });
    }
    
    /**
     * Dashboard Page
     */
    function initDashboard() {
        // Fetch dashboard data
        fetchDashboardData();
        
        // Setup charts
        setupTrendsChart();
        setupReasonsChart();
    }
    
    function fetchDashboardData() {
        // Fetch stats
        fetch(`${API_BASE_URL}/history/stats`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch stats');
                }
                return response.json();
            })
            .then(data => {
                // Update stats cards
                document.getElementById('total-audits').textContent = data.totalAudits;
                document.getElementById('pass-rate').textContent = `${data.passRate}%`;
                document.getElementById('fail-rate').textContent = `${data.failRate}%`;
                document.getElementById('today-audits').textContent = data.todayAudits;
                
                // Update charts data
                updateTrendsChart(data.trends);
                updateReasonsChart(data.topFailureReasons);
            })
            .catch(error => {
                console.error('Error fetching dashboard data:', error);
            });
        
        // Fetch recent audits
        fetch(`${API_BASE_URL}/history/latest`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch recent audits');
                }
                return response.json();
            })
            .then(data => {
                renderAuditsTable(data, 'recent-audits-table');
            })
            .catch(error => {
                console.error('Error fetching recent audits:', error);
                document.getElementById('recent-audits-table').innerHTML = 
                    `<tr><td colspan="5">Error loading recent audits: ${error.message}</td></tr>`;
            });
    }
    
    let trendsChart, reasonsChart;
    
    function setupTrendsChart() {
        const ctx = document.getElementById('trends-chart').getContext('2d');
        trendsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Passed',
                        data: [],
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        tension: 0.1
                    },
                    {
                        label: 'Failed',
                        data: [],
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }
    
    function updateTrendsChart(trendsData) {
        if (!trendsData || !trendsChart) return;
        
        trendsChart.data.labels = trendsData.dates;
        trendsChart.data.datasets[0].data = trendsData.passed;
        trendsChart.data.datasets[1].data = trendsData.failed;
        trendsChart.update();
    }
    
    function setupReasonsChart() {
        const ctx = document.getElementById('reasons-chart').getContext('2d');
        reasonsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#4a6cf7',
                        '#dc3545',
                        '#ffc107',
                        '#17a2b8',
                        '#6c757d',
                        '#28a745'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    }
                }
            }
        });
    }
    
    function updateReasonsChart(reasonsData) {
        if (!reasonsData || !reasonsChart) return;
        
        const labels = [];
        const data = [];
        
        reasonsData.forEach(item => {
            labels.push(item.reason);
            data.push(item.count);
        });
        
        reasonsChart.data.labels = labels;
        reasonsChart.data.datasets[0].data = data;
        reasonsChart.update();
    }
    
    /**
     * Audit URL Page
     */
    function initAuditPage() {
        const auditButton = document.getElementById('audit-button');
        const urlInput = document.getElementById('url-input');
        
        auditButton.addEventListener('click', function() {
            const url = urlInput.value.trim();
            
            if (!url) {
                showAuditError('Please enter a valid URL');
                return;
            }
            
            // Show loading
            document.getElementById('audit-results').classList.add('hidden');
            document.getElementById('audit-error').classList.add('hidden');
            document.getElementById('audit-loading').classList.remove('hidden');
            
            // Perform audit
            fetch(`${API_BASE_URL}/audit/url`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Audit failed');
                }
                return response.json();
            })
            .then(data => {
                // Hide loading
                document.getElementById('audit-loading').classList.add('hidden');
                
                // Show results
                renderAuditResults(data);
            })
            .catch(error => {
                // Hide loading
                document.getElementById('audit-loading').classList.add('hidden');
                
                // Show error
                showAuditError(`Audit failed: ${error.message}`);
            });
        });
    }
    
    function renderAuditResults(data) {
        const resultsContainer = document.getElementById('audit-results');
        const statusIcon = document.getElementById('audit-status-icon');
        const statusText = document.getElementById('audit-status-text');
        const auditUrl = document.getElementById('audit-url');
        const auditTimestamp = document.getElementById('audit-timestamp');
        const checksList = document.getElementById('checks-list');
        
        // Set status
        if (data.status === 'passed') {
            statusIcon.innerHTML = '<i class="fas fa-check-circle text-success"></i>';
            statusText.textContent = 'Passed';
            statusText.className = 'text-success';
        } else {
            statusIcon.innerHTML = '<i class="fas fa-times-circle text-danger"></i>';
            statusText.textContent = 'Failed';
            statusText.className = 'text-danger';
        }
        
        // Set URL and timestamp
        auditUrl.textContent = `URL: ${data.url}`;
        auditTimestamp.textContent = `Timestamp: ${new Date(data.timestamp).toLocaleString()}`;
        
        // Render checks
        checksList.innerHTML = '';
        data.checks.forEach(check => {
            const checkItem = document.createElement('div');
            checkItem.className = 'check-item';
            
            const statusClass = check.status === 'passed' ? 'pass' : 'fail';
            
            checkItem.innerHTML = `
                <div class="check-header">
                    <div class="check-name">${check.name}</div>
                    <div class="check-status ${statusClass}">${check.status}</div>
                </div>
                ${check.reason ? `<div class="check-reason">${check.reason}</div>` : ''}
                ${check.details ? `<div class="check-details">${JSON.stringify(check.details, null, 2)}</div>` : ''}
            `;
            
            checksList.appendChild(checkItem);
        });
        
        // Show results
        resultsContainer.classList.remove('hidden');
    }
    
    function showAuditError(message) {
        const errorContainer = document.getElementById('audit-error');
        const errorText = document.getElementById('error-text');
        
        errorText.textContent = message;
        errorContainer.classList.remove('hidden');
    }
    
    /**
     * Audit History Page
     */
    function initHistoryPage() {
        const searchButton = document.getElementById('search-button');
        const exportButton = document.getElementById('export-button');
        
        // Set default date values (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        document.getElementById('date-to').valueAsDate = today;
        document.getElementById('date-from').valueAsDate = thirtyDaysAgo;
        
        // Search button click
        searchButton.addEventListener('click', function() {
            searchAuditHistory(1);
        });
        
        // Export button click
        exportButton.addEventListener('click', function() {
            exportAuditHistory();
        });
    }
    
    let currentSearchParams = {};
    let totalPages = 1;
    
    function searchAuditHistory(page = 1) {
        const query = document.getElementById('search-input').value.trim();
        const status = document.getElementById('status-filter').value;
        const startDate = document.getElementById('date-from').value;
        const endDate = document.getElementById('date-to').value;
        
        // Store current search params
        currentSearchParams = { query, status, startDate, endDate, page };
        
        // Build query string
        const params = new URLSearchParams();
        if (query) params.append('query', query);
        if (status) params.append('status', status);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('page', page);
        params.append('limit', 10);
        
        // Fetch history
        fetch(`${API_BASE_URL}/history/search?${params.toString()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch history');
                }
                return response.json();
            })
            .then(data => {
                renderAuditsTable(data.results, 'history-table');
                
                // Update pagination
                totalPages = Math.ceil(data.total / 10);
                renderPagination(page, totalPages);
            })
            .catch(error => {
                console.error('Error fetching history:', error);
                document.getElementById('history-table').innerHTML = 
                    `<tr><td colspan="5">Error loading history: ${error.message}</td></tr>`;
                document.getElementById('pagination-controls').innerHTML = '';
            });
    }
    
    function renderPagination(currentPage, totalPages) {
        const paginationContainer = document.getElementById('pagination-controls');
        paginationContainer.innerHTML = '';
        
        if (totalPages <= 1) return;
        
        // Previous button
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                searchAuditHistory(currentPage - 1);
            }
        });
        paginationContainer.appendChild(prevButton);
        
        // Page buttons
        const maxButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        
        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.classList.toggle('active', i === currentPage);
            pageButton.addEventListener('click', () => {
                searchAuditHistory(i);
            });
            paginationContainer.appendChild(pageButton);
        }
        
        // Next button
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                searchAuditHistory(currentPage + 1);
            }
        });
        paginationContainer.appendChild(nextButton);
    }
    
    function exportAuditHistory() {
        const query = document.getElementById('search-input').value.trim();
        const status = document.getElementById('status-filter').value;
        const startDate = document.getElementById('date-from').value;
        const endDate = document.getElementById('date-to').value;
        
        // Build query string
        const params = new URLSearchParams();
        if (query) params.append('query', query);
        if (status) params.append('status', status);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        // Redirect to export endpoint
        window.location.href = `${API_BASE_URL}/history/export?${params.toString()}`;
    }
    
    /**
     * Statistics Page
     */
    function initStatsPage() {
        // Fetch stats data
        fetch(`${API_BASE_URL}/history/stats`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch stats');
                }
                return response.json();
            })
            .then(data => {
                // Update stats cards
                document.getElementById('stats-total-audits').textContent = data.totalAudits;
                document.getElementById('stats-unique-sites').textContent = data.uniqueSites;
                document.getElementById('stats-passed').textContent = data.passedAudits;
                document.getElementById('stats-failed').textContent = data.failedAudits;
                
                // Setup charts
                setupStatsTrendsChart(data.trends);
                setupStatsDistributionChart(data.passedAudits, data.failedAudits);
                setupStatsReasonsChart(data.topFailureReasons);
            })
            .catch(error => {
                console.error('Error fetching stats data:', error);
            });
    }
    
    function setupStatsTrendsChart(trendsData) {
        const ctx = document.getElementById('stats-trends-chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendsData.dates,
                datasets: [
                    {
                        label: 'Passed',
                        data: trendsData.passed,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        tension: 0.1
                    },
                    {
                        label: 'Failed',
                        data: trendsData.failed,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }
    
    function setupStatsDistributionChart(passed, failed) {
        const ctx = document.getElementById('stats-distribution-chart').getContext('2d');
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Passed', 'Failed'],
                datasets: [{
                    data: [passed, failed],
                    backgroundColor: [
                        '#28a745',
                        '#dc3545'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }
    
    function setupStatsReasonsChart(reasonsData) {
        const ctx = document.getElementById('stats-reasons-chart').getContext('2d');
        
        const labels = [];
        const data = [];
        
        reasonsData.forEach(item => {
            labels.push(item.reason);
            data.push(item.count);
        });
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Failure Count',
                    data: data,
                    backgroundColor: '#4a6cf7'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Shared Functions
     */
    function renderAuditsTable(audits, tableId) {
        const tableBody = document.getElementById(tableId);
        
        if (!audits || audits.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No audit results found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = '';
        
        audits.forEach(audit => {
            const row = document.createElement('tr');
            
            // Format date
            const date = new Date(audit.timestamp);
            const formattedDate = date.toLocaleString();
            
            // Status class
            const statusClass = audit.status === 'passed' ? 'text-success' : 'text-danger';
            
            row.innerHTML = `
                <td>${audit.url}</td>
                <td>${formattedDate}</td>
                <td class="${statusClass}">${audit.status}</td>
                <td>${audit.failureReason || '-'}</td>
                <td>
                    <button class="btn primary view-details" data-url="${audit.url}" data-timestamp="${audit.timestamp}">
                        View Details
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners to view details buttons
        const viewButtons = tableBody.querySelectorAll('.view-details');
        viewButtons.forEach(button => {
            button.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                const timestamp = this.getAttribute('data-timestamp');
                viewAuditDetails(url, timestamp);
            });
        });
    }
    
    function viewAuditDetails(url, timestamp) {
        // Fetch detailed check results
        fetch(`${API_BASE_URL}/history/checks/${encodeURIComponent(url)}/${timestamp}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch audit details');
                }
                return response.json();
            })
            .then(data => {
                renderAuditDetailsModal(data);
            })
            .catch(error => {
                console.error('Error fetching audit details:', error);
                alert(`Error loading audit details: ${error.message}`);
            });
    }
    
    function renderAuditDetailsModal(data) {
        const modalContent = document.getElementById('modal-content');
        
        // Format date
        const date = new Date(data.timestamp);
        const formattedDate = date.toLocaleString();
        
        // Status class
        const statusClass = data.status === 'passed' ? 'text-success' : 'text-danger';
        
        let html = `
            <div class="audit-summary">
                <div class="audit-status">
                    <span>${data.status === 'passed' ? 
                        '<i class="fas fa-check-circle text-success"></i>' : 
                        '<i class="fas fa-times-circle text-danger"></i>'}</span>
                    <span class="${statusClass}">${data.status}</span>
                </div>
                <div class="audit-url">URL: ${data.url}</div>
                <div class="audit-timestamp">Timestamp: ${formattedDate}</div>
                <div class="audit-actions">
                    <button id="recheck-button" class="btn primary" data-url="${data.url}">
                        <i class="fas fa-sync-alt"></i> Re-check Site
                    </button>
                </div>
            </div>
            
            <div class="checks-container">
                <h4>Checks</h4>
                <div class="checks-list">
        `;
        
        data.checks.forEach(check => {
            const statusClass = check.status === 'passed' ? 'pass' : 'fail';
            
            html += `
                <div class="check-item">
                    <div class="check-header">
                        <div class="check-name">${check.name}</div>
                        <div class="check-status ${statusClass}">${check.status}</div>
                    </div>
                    ${check.reason ? `<div class="check-reason">${check.reason}</div>` : ''}
                    ${check.details ? `<div class="check-details">${JSON.stringify(check.details, null, 2)}</div>` : ''}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
            <div id="modal-loading" class="hidden">
                <div class="loading-spinner"></div>
                <p>Re-checking site... This may take a minute.</p>
            </div>
            <div id="modal-error" class="hidden">
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p id="modal-error-text"></p>
                </div>
            </div>
        `;
        
        modalContent.innerHTML = html;
        
        // Add event listener to recheck button
        document.getElementById('recheck-button').addEventListener('click', function() {
            const url = this.getAttribute('data-url');
            recheckSite(url);
        });
        
        // Show modal
        document.getElementById('audit-detail-modal').style.display = 'block';
    }
    
    /**
     * Re-check a site
     */
    function recheckSite(url) {
        // Show loading
        const modalContent = document.getElementById('modal-content');
        const modalLoading = document.getElementById('modal-loading');
        const modalError = document.getElementById('modal-error');
        
        modalLoading.classList.remove('hidden');
        modalError.classList.add('hidden');
        
        // Perform audit
        fetch(`${API_BASE_URL}/audit/url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Audit failed');
            }
            return response.json();
        })
        .then(data => {
            // Hide loading
            modalLoading.classList.add('hidden');
            
            // Close modal
            document.getElementById('audit-detail-modal').style.display = 'none';
            
            // Show results in audit page
            // Switch to audit page
            document.querySelectorAll('nav a').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            
            document.querySelector('nav a[data-page="audit"]').classList.add('active');
            document.getElementById('audit').classList.add('active');
            
            // Set URL input value
            document.getElementById('url-input').value = url;
            
            // Show results
            renderAuditResults(data);
            
            // Refresh dashboard data
            fetchDashboardData();
        })
        .catch(error => {
            // Hide loading
            modalLoading.classList.add('hidden');
            
            // Show error
            modalError.classList.remove('hidden');
            document.getElementById('modal-error-text').textContent = `Audit failed: ${error.message}`;
        });
    }
    
    /**
     * Modal Setup
     */
    function setupModal() {
        const modal = document.getElementById('audit-detail-modal');
        const closeBtn = document.querySelector('.close');
        
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}); 