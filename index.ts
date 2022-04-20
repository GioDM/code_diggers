const express = require('express');
const ejs = require('ejs');
const app = express();
const axios = require('axios');

let apiData:any;

const getApi = async (api : string):Promise<void> => {
    let result = await axios.get(`https://rebrickable.com/api/v3/lego/${api}/?key=6cd12548f2028a329b97cc9f1aa3899f`);
    apiData = result.data;
};

app.set('view engine', 'ejs');
app.set('port', 3000);

app.use('/public', express.static('public'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended:true}))

app.get('/',(req:any, res:any)=>{
    res.render('projects.ejs', { title: 'IT Project | Projecten' })
})

app.get('/legomasters/', (req:any, res:any)=>{
    res.render('legomasters/landing.ejs', { title: 'LegoMasters | Homescreen' })
})

app.get('/legomasters/minifig', (req:any, res:any)=>{
    res.render('legomasters/minifig.ejs', { title: 'LegoMasters | Minifigs' })
})

app.get('/legomasters/blacklist', (req:any, res:any)=>{
    res.render('legomasters/overzichtBlacklist.ejs', { title: 'LegoMasters | Blacklist' })
})
app.post('/legomasters/sort/sort', (req:any, res:any)=>{
    let aantalMinifig = req.body.minifig;
    getApi("minifigs");
    console.log(apiData);
    res.render('legomasters/sort/ordenenMain.ejs', { 
        title: 'LegoMasters | Sorting',
        //aantal : aantalMinifig,
        //pic: minifigCode
        //number : minifigCode
    })
})
app.get('/legomasters/sort/result', (req:any, res:any)=>{
    res.render('legomasters/sort/resultaat.ejs', { title: 'LegoMasters | Sorting Result' })
})
app.get('/reference', (req: any, res: any) => {
    res.render('reference.ejs', { title: 'IT Project | References' })
})

app.get('/legomasters/summary', (req: any, res: any) => {
    res.render('legomasters/summary.ejs', { title: 'LegoMasters | Summary' })
})

app.get('/legomasters/sort/start', (req: any, res: any) => {
    res.render('legomasters/sort/beginordenen.ejs', { title: 'LegoMasters | Ordenen Start' })
})

app.use(function (req: any, res: any) {
    res.status(404).render('404.ejs');
});

app.listen(app.get('port'), () => console.log('[server] http://localhost:' + app.get('port')));
