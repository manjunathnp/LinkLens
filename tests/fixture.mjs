import http from 'node:http';
export async function fixture(){const requests=[];const server=http.createServer((req,res)=>{requests.push(req.url);const send=(status,html)=>{res.writeHead(status,{'Content-Type':'text/html'});res.end(html)};
 if(req.url==='/missing')return send(404,'<h1>404 Not found</h1>');
 if(req.url==='/redirect'){res.writeHead(302,{location:'/second'});return res.end()}
 if(req.url==='/denied')return send(403,'Access denied');
 if(req.url==='/login')return send(200,'<input type="password"><button>Sign in</button>');
 if(req.url==='/account'){res.setHeader('Set-Cookie','session=yes; Path=/; HttpOnly');return send(200,'<h1 data-authenticated="true">My account</h1><a href="/protected">Private account</a>')}
 if(req.url==='/protected')return send(req.headers.cookie?.includes('session=yes')?200:401,'<a href="/second">Private destination</a>');
 if(req.url==='/second')return send(200,'<!doctype html><title>Second page</title><a href="/">Homepage</a>');
 return send(200,`<!doctype html><html lang="en"><title>Link fixture</title><h1>Link checks</h1><a id="good" href="/second">Product details</a><a id="broken" href="/missing"></a><a id="redirect" href="/redirect">Redirected destination</a><a id="generic" href="/second">Click here</a><a id="fragment" href="#absent">Missing section</a><a id="valid-fragment" href="#section">Existing section</a><h2 id="section">Section</h2><a id="mail" href="mailto:hello@example.com">Contact support</a><a id="keyboard" href="/second" tabindex="-1">Keyboard destination</a><a id="empty" href="">Empty destination</a><a id="denied" href="/denied">Restricted resource</a><a id="action" href="/logout">Sign out</a><a id="image-name" href="/second"><img alt="Photo gallery"></a><div id="host"></div><script>document.querySelector('#host').attachShadow({mode:'open'}).innerHTML='<a id="shadow-link" href="/second">Shadow destination</a>'</script><details><summary>More navigation</summary><a id="disclosure" href="/second">Disclosed destination</a></details></html>`);
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));return{server,requests,url:'http://127.0.0.1:'+server.address().port}}
