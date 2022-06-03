import { Console, time } from "console";
import { checkPrime } from "crypto";
const {MongoClient} = require('mongodb');
const uri = 'mongodb+srv://phuong:fABJVEkElNOG8qgc@cluster0.bkwrp.mongodb.net/IT-project?retryWrites=true&w=majority'
const client = new MongoClient(uri, { useUnifiedTopology: true });

const express = require('express');
const ejs = require('ejs');
const app = express();

const axios = require('axios');

let twoSetMinifigList : any [][] = [[],[]];
let minifigIndex : number;
let sortingIndex : number = 0;
let skippedMinifigs : any[];
let arrayParts : any[] = [];
let page : number;
let aantal : number;
let done : number;
let skip : number;
let continueSorting : boolean = false;

const getApi = async (api : string):Promise<any> => {
    let result = await axios.get(`https://rebrickable.com/api/v3/lego/${api}/?key=6cd12548f2028a329b97cc9f1aa3899f`);
    return result.data;
}

const makeArray = async (list : any):Promise<void> => {
    for (let i = minifigIndex; i < list.results.length; i++) {
        let result = await axios.get(`https://rebrickable.com/api/v3/lego/minifigs/${list.results[i].set_num}/sets/?key=6cd12548f2028a329b97cc9f1aa3899f`);
        if (result.data.count > 1) {
            twoSetMinifigList[0].push(list.results[i]);
            twoSetMinifigList[1].push(result.data);
        }
        await new Promise(f => setTimeout(f, 1000));
    }
    for (let j = 0; j < skippedMinifigs.length; j++) {
        let result = await axios.get(`https://rebrickable.com/api/v3/lego/minifigs/${skippedMinifigs[j].set_num}/sets/?key=6cd12548f2028a329b97cc9f1aa3899f`);
        twoSetMinifigList[0].push(skippedMinifigs[j]);
        twoSetMinifigList[1].push(result.data);
        await new Promise(f => setTimeout(f, 1000));
    }
}
const getArrayParts = async(x:any):Promise<void> =>
{
    let result = await axios.get(`https://rebrickable.com/api/v3/lego/minifigs/${x.set_num}/parts/?key=6cd12548f2028a329b97cc9f1aa3899f`);
    let tempArray = result.data.results;
    for (let i = 0;i < tempArray.length;i++)
    {
        arrayParts.push(tempArray[i].part);
    }
}
const putInDb = async (collection : string, object : any):Promise<void> => {
    await client.connect();
    let result = await client.db('IT-project').collection(collection).insertOne(object);
}

const getInfo = async():Promise<void> =>
{
    await client.connect();
    let result = await client.db('IT-project').collection('Session').findOne({name: 'pageIndex'});
    page = result.index;
    aantal = result.minifigsAantal;
    done = result.minifigsDone;
    skip = result.minifigsSkipped;
    await client.close();
}

const sendInfo = async():Promise<void> =>
{
    await client.connect();
    let result = await client.db('IT-project').collection('Session').updateOne({name: 'pageIndex'}, {$set:{index: page, minifigsAantal: aantal, minifigsDone: done, minifigsSkipped: skip}});
}

const getIndex = async():Promise<void> =>
{
    await client.connect();
    let result = await client.db('IT-project').collection('Session').findOne({name: 'minifigIndex'});
    minifigIndex = result.index;
    await client.close();
}

const sendIndex = async(minifig : any):Promise<void> =>
{
    await client.connect();
    let newIndex : number = parseInt(minifig.set_num.substr(4,6));
    let result = await client.db('IT-project').collection('Session').updateOne({name: 'minifigIndex'}, {$set:{index: newIndex}});
}

const getSkippedArray = async():Promise<void> =>
{
    await client.connect();
    let cursor = client.db('IT-project').collection('Skipped').find({});
    skippedMinifigs = await cursor.toArray();
    await client.close();
}

const delSkipped = async(toDelete : any):Promise<void> =>
{
    await client.connect();
    await client.db('IT-project').collection('Skipped').deleteOne({set_num: toDelete});
}


( async() => {
    await getIndex();
    await getSkippedArray();
    await getApi('minifigs').then(x => {
        makeArray(x);
    });
})()


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


app.get('/legomasters/sort/', async (req: any, res: any) => {
    await getInfo();
    if (page === 1) {
        res.render('legomasters/sort/beginordenen.ejs', { title: 'LegoMasters | Ordenen Start' });
    }
    else {
        continueSorting = true;
        res.redirect(`/legomasters/sort/page/${page}`);
    }
})

app.post('/legomasters/sort/start', (req:any, res:any)=>{
    aantal = parseInt(req.body.minifig);
    done = 0;
    skip = 0;
    res.redirect(`/legomasters/sort/page/${page}`);
})

app.post('/legomasters/sort/add', async (req:any, res:any)=>{
    let selectedSet:any = twoSetMinifigList[1][sortingIndex].results[req.body.choiceSet];
    twoSetMinifigList[0][sortingIndex].selected_img_url = selectedSet.set_img_url;
    twoSetMinifigList[0][sortingIndex].selected_num = selectedSet.set_num;
    await putInDb('MinifigAndSet', twoSetMinifigList[0][sortingIndex]);
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
    twoSetMinifigList[0][sortingIndex].reason = req.body.reason;
    await putInDb('Blacklist', twoSetMinifigList[0][sortingIndex]);
    page++; 
    if (page <= aantal) {
        res.redirect(`/legomasters/sort/page/${page}`);
    }
    else {
        res.redirect('/legomasters/sort/result');
    }
})

app.post('/legomasters/sort/skip', async (req:any, res:any)=>{
    await putInDb('Skipped', twoSetMinifigList[0][sortingIndex]);
    page++;
    skip++;
    if (page <= aantal) {
        res.redirect(`/legomasters/sort/page/${page}`);
    }
    else {
        res.redirect('/legomasters/sort/result');
    }
})

app.get('/legomasters/sort/page/:page', async (req:any, res:any)=>{
    if (page != 1 && continueSorting == false) {
        if (skippedMinifigs.includes(twoSetMinifigList[0][sortingIndex])) {
            await delSkipped(twoSetMinifigList[0][sortingIndex].set_num);
        }
        else {
            await sendIndex(twoSetMinifigList[0][sortingIndex]);
        }
        await sendInfo();
        sortingIndex++;   
    }
    else {
        continueSorting = false;
    }
    await client.close();
    res.render('legomasters/sort/ordenenMain.ejs', { 
        title: 'LegoMasters | Sorting Main',
        minifigs : twoSetMinifigList,
        index : sortingIndex
    })
})

app.get('/legomasters/sort/result', async (req:any, res:any)=>{
    if (skippedMinifigs.includes(twoSetMinifigList[0][sortingIndex])) {
        await delSkipped(twoSetMinifigList[0][sortingIndex].set_num);
    }
    else {
        await sendIndex(twoSetMinifigList[0][sortingIndex]);
    }
    sortingIndex++;
    page = 1;
    await sendInfo();
    await client.close();
    res.render('legomasters/sort/resultaat.ejs', { 
        title: 'LegoMasters | Sorting Result',
        minifigsAdded : done,
        minifigsSkipped : skip
    })
})


app.get('/legomasters/minifig/:minifigCode', async (req:any, res:any)=>{
    await client.connect();
    let result = await client.db('IT-project').collection('MinifigAndSet').findOne({set_num:req.params.minifigCode});
    if (result == null)
    {
        result = await client.db('IT-project').collection('Blacklist').findOne({set_num:req.params.minifigCode});
    }
    await getArrayParts(result);
    await client.close();
    res.render('legomasters/minifig.ejs', { title: 'LegoMasters | Minifigs', result,arrayParts })
    arrayParts = [];
})

app.get('/legomasters/set/:setCode', async (req:any, res:any)=>{
    await client.connect();
    let cursor =  client.db('IT-project').collection('MinifigAndSet').find({selected_num:req.params.setCode});
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
app.post('/legomasters/blacklist/reason', async (req:any, res:any)=>{
    await client.connect();
    await client.db('IT-project').collection('Blacklist').updateOne({name:req.body.name}, {$set:{reason:req.body.reason}});
    await client.close();
    res.redirect('/legomasters/blacklist');
})

app.get('/legomasters/summary', async (req: any, res: any) => {
    await client.connect();
    let cursor =  client.db('IT-project').collection('MinifigAndSet').find({});
    let result = await cursor.toArray();
    await client.close();
    res.render('legomasters/summary.ejs', { title: 'LegoMasters | Summary', result })
})
app.post('/legomasters/summary/delete', async (req: any, res: any) => {
    let result = await axios.get(`https://rebrickable.com/api/v3/lego/minifigs/${req.body.minifig}/?key=6cd12548f2028a329b97cc9f1aa3899f`);
    await putInDb('Skipped', result.data);
    await client.db('IT-project').collection("MinifigAndSet").deleteOne({name: result.data.name});
    res.redirect('/legomasters/summary');
})
app.get('/reference', (req: any, res: any) => {
    res.render('reference.ejs', { title: 'IT Project | References' })
})

app.use(function (req: any, res: any) {
    res.status(404).render('404.ejs');
});

app.listen(app.get('port'), () => console.log('[server] http://localhost:' + app.get('port')));
