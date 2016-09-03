var http = require('http'),        // Http服务器API
    fs = require('fs'),            // 用于处理本地文件
    server = new http.Server();    // 创建新的HTTP服务器
    
server.listen(8003);            // 监听端口

var types = {
        'html':     'text/html; charset=UTF-8',
        'htm':      'text/html; charset=UTF-8',
        'js':       'application/javascript; charset="UTF-8"',
        'css':      'text/css; charset="UTF-8"',
        'txt':      'text/plain; charset="UTF-8"',
        'manifest': 'text/cache-manifest; charset="UTF-8"'
    },
    defaultType = 'application/octet-stream';

function ready(pathname, response) { 
    var path = pathname.substring(1);     // 去掉前导'/'
    if (/\./.test(path.split('/').pop())) {
        var type = types[path.substring(path.lastIndexOf('.')+1)] || defaultType;
        fs.readFile(path, function(err, content){                
            if(err) {
                response.writeHead(404, { 'Content-Type':'text/html; charset="UTF-8"' });
                response.write(err.message);
                response.end();
            } else {
                response.writeHead(200, { 'Content-Type' : type, 'Cache-Control': 'public, max-age=31536000' });
                response.write(content);
                response.end();
            }
        });
    } else {
        if (path && path.split('').pop() !== '/') { path+='/'; }

        fs.readFile(path+'index.html', function(err, content){
            if (err) {
                response.writeHead(404, { 'Content-Type':'text/plain; charset="UTF-8"' });
                response.write(err.message);
                response.end();
            } else {
                response.writeHead(200, { 'Content-Type' : 'text/html; charset=UTF-8' });
                response.write(content);                
                response.end();
            }
        });
    }
}

server.on('request', function(request, response) {
    var url = require('url').parse(request.url);
    ready(url.pathname, response);    
});