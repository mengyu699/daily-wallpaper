const moment = require('moment');

class Helpers {
    formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
        if (!date) return '未知时间';
        return moment(date).format(format);
    }

    formatRelativeTime(date) {
        if (!date) return '未知时间';
        return moment(date).fromNow();
    }

    sanitizeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    highlightKeywords(text, keywords) {
        if (!text || !keywords || keywords.length === 0) return text;
        
        let highlightedText = text;
        keywords.forEach(keyword => {
            const regex = new RegExp(`(${this.escapeRegExp(keyword)})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
        });
        
        return highlightedText;
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    truncateText(text, maxLength = 100) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getMessageTypeIcon(type) {
        const icons = {
            'text': '💬',
            'image': '🖼️',
            'voice': '🎤',
            'video': '🎥',
            'file': '📎',
            'location': '📍',
            'link': '🔗',
            'emoji': '😊',
            'system': '⚙️'
        };
        return icons[type] || '📄';
    }

    getMessageTypeLabel(type) {
        const labels = {
            'text': '文本',
            'image': '图片',
            'voice': '语音',
            'video': '视频',
            'file': '文件',
            'location': '位置',
            'link': '链接',
            'emoji': '表情',
            'system': '系统消息'
        };
        return labels[type] || '未知类型';
    }

    groupMessagesByDate(messages) {
        const grouped = {};
        
        messages.forEach(message => {
            if (!message.timestamp) return;
            
            const dateKey = moment(message.timestamp).format('YYYY-MM-DD');
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(message);
        });
        
        return grouped;
    }

    groupMessagesByHour(messages) {
        const hourCounts = {};
        
        for (let i = 0; i < 24; i++) {
            hourCounts[i] = 0;
        }
        
        messages.forEach(message => {
            if (message.timestamp) {
                const hour = moment(message.timestamp).hour();
                hourCounts[hour]++;
            }
        });
        
        return hourCounts;
    }

    calculateMessageFrequency(messages) {
        if (!messages || messages.length === 0) return {};
        
        const senderCounts = {};
        messages.forEach(message => {
            const sender = message.sender || '未知';
            senderCounts[sender] = (senderCounts[sender] || 0) + 1;
        });
        
        return Object.entries(senderCounts)
            .sort(([,a], [,b]) => b - a)
            .reduce((result, [sender, count]) => {
                result[sender] = {
                    count,
                    percentage: ((count / messages.length) * 100).toFixed(1)
                };
                return result;
            }, {});
    }

    generateRandomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    validateSearchParams(params) {
        const errors = [];
        
        if (params.startDate && params.endDate) {
            const start = moment(params.startDate);
            const end = moment(params.endDate);
            
            if (!start.isValid()) {
                errors.push('开始日期格式不正确');
            }
            if (!end.isValid()) {
                errors.push('结束日期格式不正确');
            }
            if (start.isValid() && end.isValid() && start.isAfter(end)) {
                errors.push('开始日期不能晚于结束日期');
            }
        }
        
        if (params.query && params.query.length > 1000) {
            errors.push('搜索关键词过长');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    formatSearchResults(results, query) {
        if (!results || results.length === 0) {
            return {
                total: 0,
                messages: [],
                summary: '未找到匹配的消息'
            };
        }
        
        const keywords = query ? query.split(/\s+/).filter(k => k.length > 0) : [];
        
        const formattedMessages = results.map(message => ({
            ...message,
            highlightedContent: this.highlightKeywords(message.content, keywords),
            formattedTime: this.formatDate(message.timestamp),
            relativeTime: this.formatRelativeTime(message.timestamp),
            typeIcon: this.getMessageTypeIcon(message.type),
            typeLabel: this.getMessageTypeLabel(message.type)
        }));
        
        return {
            total: results.length,
            messages: formattedMessages,
            summary: `找到 ${results.length} 条相关消息`,
            keywords
        };
    }

    generateChartData(messages) {
        const timeDistribution = this.groupMessagesByHour(messages);
        const dateDistribution = this.groupMessagesByDate(messages);
        const senderFrequency = this.calculateMessageFrequency(messages);
        
        return {
            hourlyActivity: {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                data: Object.values(timeDistribution),
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)'
            },
            dailyActivity: {
                labels: Object.keys(dateDistribution).sort(),
                data: Object.values(dateDistribution).map(msgs => msgs.length),
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)'
            },
            senderDistribution: {
                labels: Object.keys(senderFrequency).slice(0, 10),
                data: Object.values(senderFrequency).slice(0, 10).map(s => s.count),
                backgroundColor: Object.keys(senderFrequency).slice(0, 10).map(() => this.generateRandomColor())
            }
        };
    }

    exportToCSV(messages) {
        const headers = ['时间', '发送者', '内容', '类型', '群聊'];
        const rows = messages.map(msg => [
            this.formatDate(msg.timestamp),
            msg.senderName || msg.sender,
            msg.content.replace(/"/g, '""'),
            this.getMessageTypeLabel(msg.type),
            msg.chatroomName || ''
        ]);
        
        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
            
        return csvContent;
    }

    exportToJSON(messages) {
        return JSON.stringify(messages, null, 2);
    }

    logActivity(action, details = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action,
            details,
            userAgent: 'ChatlogWebUI/1.0.0'
        };
        
        console.log('Activity Log:', logEntry);
        return logEntry;
    }
}

module.exports = new Helpers();