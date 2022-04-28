import { time } from "console";
const {MongoClient} = require('mongodb');
const uri = 'mongodb+srv://phuong:fABJVEkElNOG8qgc@cluster0.bkwrp.mongodb.net/IT-project?retryWrites=true&w=majority'
const client = new MongoClient(uri, { useUnifiedTopology: true });
/*let doSomeDBCalls = async () => {
    try {
        await client.connect();
        await client.db('IT-project').collection('code_diggers').deleteMany({});
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
doSomeDBCalls();*/

interface minifigAndSet
{
    urlImageMinifig:string;
    codeMinifig:string;
    urlImageSet:string;
    codeSet:string;
    type:string; //summary
}
interface blacklistMinifig
{
    urlImageMinifig:string;
    codeMinifig:string;
    reason: string;
    type:string; //blacklist
}

const express = require('express');
const ejs = require('ejs');
const app = express();
const axios = require('axios');

const getApi = async (api : string):Promise<any> => {
    let result = await axios.get(`https://rebrickable.com/api/v3/lego/${api}/?key=6cd12548f2028a329b97cc9f1aa3899f`);
    return result.data;
}

let twoSetMinifigList : any [][] = [[],[]];

const makeArray = async (list : any):Promise<void> => {
    for (let i = 0; i < list.results.length; i++) {
        let result = await axios.get(`https://rebrickable.com/api/v3/lego/minifigs/${list.results[i].set_num}/sets/?key=6cd12548f2028a329b97cc9f1aa3899f`);
        if (result.data.count > 1) {
            twoSetMinifigList[0].push(list.results[i]);
            twoSetMinifigList[1].push(result.data);
        }
        await new Promise(f => setTimeout(f, 1000));
    }
}


getApi('minifigs').then(x => {
    makeArray(x);
});

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
app.get('/legomasters/sort/', (req: any, res: any) => {
    res.render('legomasters/sort/beginordenen.ejs', { title: 'LegoMasters | Ordenen Start' })
})
let page : number;
let done : number;
let skip : number;
let aantal : number;
app.post('/legomasters/sort/start', (req:any, res:any)=>{
    aantal = req.body.minifig;
    done = 0;
    skip = 0;
    page = 1;
    res.redirect(`/legomasters/sort/page/${page}`);
})
app.post('/legomasters/sort/add', async (req:any, res:any)=>{
    
    await client.connect();
    let addNewMinifigAndSet: minifigAndSet =
    {
        urlImageMinifig: twoSetMinifigList[0][0].set_img_url,
        codeMinifig: twoSetMinifigList[0][0].set_num,
        urlImageSet: req.body.fotoSet,
        codeSet: req.body.choiceSet,
        type: 'summary'
    }
    const result = await client.db('IT-project').collection('code_diggers').insertOne(addNewMinifigAndSet);
    console.log(`New listing created with the following id: ${result.insertedId}`);
    await client.close();
    //console.log(twoSetMinifigList[0][0].set_num);
    //console.log(req.body.choiceSet);
    twoSetMinifigList[0].shift();
    twoSetMinifigList[1].shift();
    page++;
    done++;
    if (page <= aantal) {
        res.redirect(`/legomasters/sort/page/${page}`);
    }
    else {
        res.redirect('/legomasters/sort/result');
    }
})
app.post('/legomasters/sort/blacklist', async (req:any, res:any)=>{
    await client.connect();
    let addBlacklist: blacklistMinifig =
    {
        urlImageMinifig:twoSetMinifigList[0][0].set_img_url,
        codeMinifig:twoSetMinifigList[0][0].set_num,
        reason: "",
        type:"blacklist"
    }
    const result = await client.db('IT-project').collection('code_diggers').insertOne(addBlacklist);
    console.log(`New listing created with the following id: ${result.insertedId}`);
    await client.close();
    //console.log(twoSetMinifigList[0][0].set_num);
    twoSetMinifigList[0].shift();
    twoSetMinifigList[1].shift();
    page++;
    if (page <= aantal) {
        res.redirect(`/legomasters/sort/page/${page}`);
    }
    else {
        res.redirect('/legomasters/sort/result');
    }
})
app.post('/legomasters/sort/skip', (req:any, res:any)=>{
    twoSetMinifigList[0].push(twoSetMinifigList[0].shift());
    twoSetMinifigList[1].push(twoSetMinifigList[1].shift());
    page++;
    skip++;
    if (page <= aantal) {
        res.redirect(`/legomasters/sort/page/${page}`);
    }
    else {
        res.redirect('/legomasters/sort/result');
    }
})
app.get('/legomasters/sort/page/:page', (req:any, res:any)=>{
    res.render('legomasters/sort/ordenenMain.ejs', { 
        title: 'LegoMasters | Sorting Main',
        minifigs : twoSetMinifigList,
    })
})
app.get('/legomasters/sort/result', (req:any, res:any)=>{
    res.render('legomasters/sort/resultaat.ejs', { 
        title: 'LegoMasters | Sorting Result',
        minifigsAdded : done,
        minifigsSkipped : skip
    })
})
app.get('/reference', (req: any, res: any) => {
    res.render('reference.ejs', { title: 'IT Project | References' })
})

app.get('/legomasters/summary', (req: any, res: any) => {
    res.render('legomasters/summary.ejs', { title: 'LegoMasters | Summary' })
})

app.use(function (req: any, res: any) {
    res.status(404).render('404.ejs');
});

app.listen(app.get('port'), () => console.log('[server] http://localhost:' + app.get('port')));
