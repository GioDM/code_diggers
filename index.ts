//todo:
//send minifigIndex to db
//send skippedMinifigs to db
//create func to send to db?
//fix mongodb 'cannot use session that has ended' error
//change code order so summary pages come after sort pages + variable and functions order; aka make this page readable

import { Console, time } from "console";
import { checkPrime } from "crypto";
const {MongoClient} = require('mongodb');
const uri = 'mongodb+srv://phuong:fABJVEkElNOG8qgc@cluster0.bkwrp.mongodb.net/IT-project?retryWrites=true&w=majority'
const client = new MongoClient(uri, { useUnifiedTopology: true });

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

const putInDb = async (collection : string, object : any):Promise<void> => {
    await client.connect();
    let result = await client.db('IT-project').collection(collection).insertOne(object);
    if (aantal < page) {
        await client.close();
    }
}

let minifigIndex : number;

const getIndex = async():Promise<void> =>
{
    await client.connect();
    let result = await client.db('IT-project').collection('Session').findOne({name:'dbIndex'});
    minifigIndex = result.index;
}

let skippedIndexes : any[];
let skippedCounter : number = 0;

const getSkippedArray = async():Promise<void> =>
{
    await client.connect();
    let cursor = client.db('IT-project').collection('Skipped').find({});
    skippedIndexes = await cursor.toArray();
    await client.close();
}

const delSkipped = async(toDelete:any):Promise<void> =>
{
    await client.connect();
    client.db('IT-project').collection('Skipped').deleteOne({index: toDelete})
    await client.close();
}

getIndex();
getSkippedArray();

let page : number;
let done : number;
let skip : number;
let aantal : number;

getApi('minifigs').then(x => {
    makeArray(x);
});
app.set('view engine', 'ejs');
app.set('port', 3000);

app.use('/public', express.static('public'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended:true}))

app.get('/',(req:any, res:any)=>{
    res.render('projects.ejs', { title: 'IT P:ct | Projecten' })
})

app.get('/legomasters/', (req:any, res:any)=>{
    res.render('legomasters/landing.ejs', { title: 'LegoMasters | Homescreen' })
})

app.get('/legomasters/minifig/:minifigCode', async (req:any, res:any)=>{
    let result= await client.db('IT-project').collection('MinifigAndSet').findOne({set_num:req.params.minifigCode});
    await client.close();
    res.render('legomasters/minifig.ejs', { title: 'LegoMasters | Minifigs', result })
})
app.get('/legomasters/set/:setCode', async (req:any, res:any)=>{
    await client.connect();
    let cursor =  client.db('IT-project').collection('MinifigAndSet').find({selected_set_num:req.params.setCode});
    let result = await cursor.toArray();
    await client.close();
    res.render('legomasters/set.ejs', { title: 'LegoMasters | Set', result })
})
app.get(`/legomasters/blacklist`, async (req:any, res:any)=>{
    await client.connect();
    let cursor =  client.db('IT-project').collection('Blacklist').find({});
    let result = await cursor.toArray();
    await client.close();
    res.render('legomasters/overzichtBlacklist.ejs', { title: 'LegoMasters | Blacklist', result})
})
app.get('/legomasters/sort/', (req: any, res: any) => {
    res.render('legomasters/sort/beginordenen.ejs', { title: 'LegoMasters | Ordenen Start' })
})
app.post('/legomasters/sort/start', (req:any, res:any)=>{
    aantal = req.body.minifig;
    done = 0;
    skip = 0;
    page = 1;
    res.redirect(`/legomasters/sort/page/${page}`);
})
app.post('/legomasters/sort/add', async (req:any, res:any)=>{
    page++; 
    let selectedSet:any = twoSetMinifigList[1][minifigIndex].results[req.body.choiceSet];
    twoSetMinifigList[0][minifigIndex].selected_set_img = selectedSet.set_img_url;
    twoSetMinifigList[0][minifigIndex].selected_set_num = selectedSet.set_num;
    putInDb('MinifigAndSet', twoSetMinifigList[0][minifigIndex]);
    done++;
    minifigIndex++;
    if (page <= aantal) {
        res.redirect(`/legomasters/sort/page/${page}`);
    }
    else {
        res.redirect('/legomasters/sort/result');
    }
})
app.post('/legomasters/sort/blacklist', async (req:any, res:any)=>{
    page++; //moet voor 'putInDb' blijven staan zodat de db op juiste moment gesloten wordt
    twoSetMinifigList[0][minifigIndex].reason = "test";
    putInDb('Blacklist', twoSetMinifigList[0][minifigIndex]);
    minifigIndex++;
    if (page <= aantal) {
        res.redirect(`/legomasters/sort/page/${page}`);
    }
    else {
        res.redirect('/legomasters/sort/result');
    }
})
app.post('/legomasters/sort/skip', (req:any, res:any)=>{
    getSkippedArray();
    skippedCounter = 0;
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
    let tempIndex : number;
    if (minifigIndex < twoSetMinifigList[0].length) {
        tempIndex = minifigIndex;
    }
    else {
        tempIndex = skippedIndexes[skippedCounter].index;
        delSkipped(skippedIndexes[skippedCounter].index)
        skippedCounter++;
    }
    res.render('legomasters/sort/ordenenMain.ejs', { 
        title: 'LegoMasters | Sorting Main',
        minifigs : twoSetMinifigList,
        index : tempIndex
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

app.get('/legomasters/summary', async (req: any, res: any) => {
    await client.connect();
    let cursor =  client.db('IT-project').collection('MinifigAndSet').find({});
    let result = await cursor.toArray();
    await client.close();
    res.render('legomasters/summary.ejs', { title: 'LegoMasters | Summary', result })
})

app.use(function (req: any, res: any) {
    res.status(404).render('404.ejs');
});

app.listen(app.get('port'), () => console.log('[server] http://localhost:' + app.get('port')));
