const express = require('express');
const ejs = require('ejs');
const app = express();

app.set('view engine', 'ejs');
app.set('port', 3000);

app.use('/public', express.static('public'));

app.get('/', (req: any, res: any) => {
    res.render('main.ejs')
})

app.get('/reference', (req: any, res: any) => {
    res.render('reference.ejs')
})

app.get('/summary', (req: any, res: any) => {
    res.render('summary.ejs')
})

app.get('/header', (req: any, res: any) => {
    res.render('header.ejs')
})

app.use(function (req: any, res: any) {
    res.status(404).render('404.ejs');
});

app.listen(app.get('port'), () => console.log('[server] http://localhost:' + app.get('port')));