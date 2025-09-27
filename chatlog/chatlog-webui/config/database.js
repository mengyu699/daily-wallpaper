const path = require('path');

module.exports = {
    chatlog: {
        host: 'localhost',
        port: 8080,
        baseUrl: 'http://localhost:8080'
    },
    
    local: {
        dataPath: path.join(__dirname, '..', 'data', 'chatlogs'),
        dbPath: path.join(__dirname, '..', 'data', 'chatlog.db'),
        backupPath: path.join(__dirname, '..', 'data', 'backup')
    },
    
    wechat: {
        dataPath: process.platform === 'darwin' 
            ? path.join(process.env.HOME, 'Library', 'Containers', 'com.tencent.xinWeChat', 'Data', 'Library', 'Application Support', 'com.tencent.xinWeChat')
            : path.join(process.env.USERPROFILE, 'Documents', 'WeChat Files'),
        msgDbName: 'msg.db',
        contactDbName: 'contact.db'
    },
    
    sqlite: {
        filename: path.join(__dirname, '..', 'data', 'app.db'),
        options: {
            mode: 'OPEN_READWRITE | OPEN_CREATE',
            verbose: console.log
        }
    }
};