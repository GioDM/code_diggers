const express = require('express');
const ejs= require('ejs');
const app = express();

app.set('view engine', 'ejs');
app.set('port', 3000);

app.get('/',(req:any, res:any)=>{
    res.render('main.ejs')
})

app.get('/blacklist', (req:any, res:any)=>{
    res.render('overzichtBlacklist.ejs')
})

app.get('/reference', (req:any, res:any)=>{
    res.render('reference.ejs')
})

app.use(function(req:any,res:any){
    res.status(404).render('404.ejs');
});

app.listen(app.get('port'), ()=>console.log( '[server] http://localhost:' + app.get('port')));