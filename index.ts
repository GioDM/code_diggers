import { Console, time } from "console";
import { checkPrime } from "crypto";
const {MongoClient} = require('mongodb');
const uri = 'mongodb+srv://phuong:fABJVEkElNOG8qgc@cluster0.bkwrp.mongodb.net/IT-project?retryWrites=true&w=majority';
const client = new MongoClient(uri, { useUnifiedTopology: true });

const express = require('express');
const ejs = require('ejs');
const app = express();

const axios = require('axios');

require('dotenv').config();

let twoSetMinifigList : any [][] = [[],[]];
let minifigIndex : number;
let twoSetsIndexes : number[] = [];
let sortingIndex : number = 0;
let skippedMinifigs : any[];
let arrayParts : any[] = [];
let page : number;
let amount : number;
let done : number;
let skip : number;
let continueSorting : boolean = false;
let makeArrayDone : boolean = false;
let newSkipped : boolean = false;
let skippedAgain : boolean = false;

const getApi = async (api : string):Promise<any> => {
    let result = await axios.get(`https://rebrickable.com/api/v3/lego/${api}/?key=${process.env.API_KEY}`);
    return result.data;
}

const makeArray = async (list : any):Promise<void> => {
    for (let i = minifigIndex + 1; i < list.results.length; i++) {
        let result = await axios.get(`https://rebrickable.com/api/v3/lego/minifigs/${list.results[i].set_num}/sets/?key=${process.env.API_KEY}`);
        if (result.data.count > 1) {
            twoSetsIndexes.push(i);
            twoSetMinifigList[0].push(list.results[i]);
            twoSetMinifigList[1].push(result.data);
        }
        await new Promise(f => setTimeout(f, 1000));
    }
    for (let j = 0; j < skippedMinifigs.length; j++) {
        let result = await axios.get(`https://rebrickable.com/api/v3/lego/minifigs/${skippedMinifigs[j].set_num}/sets/?key=${process.env.API_KEY}`);
        twoSetMinifigList[0].push(skippedMinifigs[j]);
        twoSetMinifigList[1].push(result.data);
        await new Promise(f => setTimeout(f, 1000));
    }
    makeArrayDone = true;
}

const addToTwoSetList = async(minifig : any):Promise<void> => {
    await getApi(`minifigs/${minifig.set_num}/sets`).then(result => {
        twoSetMinifigList[0].push(minifig);
        twoSetMinifigList[1].push(result);
    });
}

const getArrayParts = async(minifig:any):Promise<void> => {
    let result = await axios.get(`https://rebrickable.com/api/v3/lego/minifigs/${minifig.set_num}/parts/?key=${process.env.API_KEY}`);
    let tempArray = result.data.results;
    for (let i = 0;i < tempArray.length;i++) {
        arrayParts.push(tempArray[i].part);
    }
}
const putInDb = async (collection : string, object : any):Promise<void> => {
    await client.connect();
    await client.db('IT-project').collection(collection).insertOne(object);
}

const getInfo = async():Promise<void> => {
    await client.connect();
    let result = await client.db('IT-project').collection('Session').findOne({name: 'pageIndex'});
    page = result.index;
    amount = result.minifigsAmount;
    done = result.minifigsDone;
    skip = result.minifigsSkipped;
}

const sendInfo = async(page : number, amount : number, done : number, skip : number):Promise<void> => {
    await client.connect();
    await client.db('IT-project').collection('Session').updateOne({name: 'pageIndex'}, {$set:{index: page, minifigsAmount: amount, minifigsDone: done, minifigsSkipped: skip}});
}

const getIndex = async():Promise<void> => {
    await client.connect();
    let result = await client.db('IT-project').collection('Session').findOne({name: 'minifigIndex'});
    minifigIndex = result.index;
}

const sendIndex = async():Promise<void> => {
    await client.connect();
    let newIndex : number = twoSetsIndexes[sortingIndex];
    await client.db('IT-project').collection('Session').updateOne({name: 'minifigIndex'}, {$set:{index: newIndex}});
}

const getSkippedArray = async():Promise<void> => {
    await client.connect();
    let cursor = client.db('IT-project').collection('Skipped').find({});
    skippedMinifigs = await cursor.toArray();
}

const delSkipped = async(toDelete : any):Promise<void> => {
    await client.connect();
    await client.db('IT-project').collection('Skipped').deleteOne({set_num: toDelete});
}

const resetDb = async():Promise<void> => {
    await client.connect();
    await client.db('IT-project').collection('MinifigAndSet').deleteMany({});
    await client.db('IT-project').collection('Blacklist').deleteMany({});
    await client.db('IT-project').collection('Skipped').deleteMany({});
    await client.db('IT-project').collection('Session').updateOne({name: 'minifigIndex'}, {$set:{index: 0}});
    await client.db('IT-project').collection('Session').updateOne({name: 'pageIndex'}, {$set:{index: 0, minifigsAmount: 0, minifigsDone: 0, minifigsSkipped: 0}});
    await client.close();
    sortingIndex = 0;
}

( async() => {
    await getIndex();
    await getSkippedArray();
    await getApi('minifigs').then(minifigList => {
        makeArray(minifigList);
    });
})();


app.set('view engine', 'ejs');
app.set('port', process.env.PORT || 3000);

app.use('/public', express.static('public'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended:true}));

app.get('/',(req:any, res:any)=> {
    res.render('projects.ejs', { title: 'IT Projects | Projecten' });
});

app.get('/legomasters/', (req:any, res:any) => {
    res.render('legomasters/landing.ejs', { title: 'LegoMasters | Startpagina' });
});

app.get('/legomasters/sorteren/', async (req: any, res: any) => {
    await getInfo();
    if (page === 0) {
        let limit = 15;
        if ((twoSetMinifigList[0].length - sortingIndex) < 15) {
            limit = twoSetMinifigList[0].length - sortingIndex;
        }
        res.render('legomasters/sort/beginordenen.ejs', { title: 'LegoMasters | Sorteren Start', limit });
    }
    else {
        continueSorting = true;
        res.redirect(`/legomasters/sorteren/pagina/${page}`);
    }
});

app.post('/legomasters/sorteren/start', async (req:any, res:any) => {
    amount = parseInt(req.body.minifig);
    page = 1;
    await sendInfo(page, amount, 0, 0);
    res.redirect(`/legomasters/sorteren/pagina/${page}`);
});

app.post('/legomasters/sorteren/add', async (req:any, res:any) => {
    let selectedSet:any = twoSetMinifigList[1][sortingIndex].results[req.body.choiceSet];
    twoSetMinifigList[0][sortingIndex].selected_img_url = selectedSet.set_img_url;
    twoSetMinifigList[0][sortingIndex].selected_num = selectedSet.set_num;
    await putInDb('MinifigAndSet', twoSetMinifigList[0][sortingIndex]);
    page++; 
    done++;
    if (page <= amount) {
        res.redirect(`/legomasters/sorteren/pagina/${page}`);
    }
    else {
        res.redirect('/legomasters/sorteren/resultaat');
    }
});

app.post('/legomasters/sorteren/blacklist', async (req:any, res:any) => {
    twoSetMinifigList[0][sortingIndex].reason = req.body.reason;
    await putInDb('Blacklist', twoSetMinifigList[0][sortingIndex]);
    page++; 
    if (page <= amount) {
        res.redirect(`/legomasters/sorteren/pagina/${page}`);
    }
    else {
        res.redirect('/legomasters/sorteren/resultaat');
    }
});

app.post('/legomasters/sorteren/skip', async (req:any, res:any) => {
    await client.connect();
    let result = await client.db('IT-project').collection('Skipped').countDocuments({set_num: twoSetMinifigList[0][sortingIndex].set_num}, {limit: 1});
    if (result === 0) {
        await putInDb('Skipped', twoSetMinifigList[0][sortingIndex]);
        newSkipped = true;     
    }
    if (makeArrayDone) {
        await addToTwoSetList(twoSetMinifigList[0][sortingIndex]);
        skippedAgain = true;
    }
    page++;
    skip++;
    if (page <= amount) {
        res.redirect(`/legomasters/sorteren/pagina/${page}`);
    }
    else {
        res.redirect('/legomasters/sorteren/resultaat');
    }
});

app.get('/legomasters/sorteren/pagina/:page', async (req:any, res:any) => {
    if (page != 1 && !continueSorting) {
        await client.connect();
        let result = await client.db('IT-project').collection('Skipped').countDocuments({set_num: twoSetMinifigList[0][sortingIndex].set_num}, {limit: 1});
        if (newSkipped || result === 0) {
            await sendIndex();
        }
        else if (!skippedAgain) {
            await delSkipped(twoSetMinifigList[0][sortingIndex].set_num);
        }
        await sendInfo(page, amount, done, skip);
        sortingIndex++;
        newSkipped = false;
        skippedAgain = false;
    }
    else {
        continueSorting = false;
    }
    await client.close();
    res.render('legomasters/sort/ordenenMain.ejs', { 
        title: 'LegoMasters | Sorteerpagina',
        minifigs : twoSetMinifigList,
        index : sortingIndex
    });
});

app.get('/legomasters/sorteren/resultaat', async (req:any, res:any) => {
    await client.connect();
    let result = await client.db('IT-project').collection('Skipped').countDocuments({set_num: twoSetMinifigList[0][sortingIndex].set_num}, {limit: 1});
    if (newSkipped || result === 0) {
        await sendIndex();
    }
    else if (!skippedAgain) {
        await delSkipped(twoSetMinifigList[0][sortingIndex].set_num); 
    }
    newSkipped = false;
    skippedAgain = false;
    sortingIndex++;
    await sendInfo(0, 0, 0, 0);
    await client.close();
    res.render('legomasters/sort/resultaat.ejs', { 
        title: 'LegoMasters | Sorteerresultaat',
        minifigsAdded : done,
        minifigsSkipped : skip
    });
});

app.get('/legomasters/overzicht', async (req: any, res: any) => {
    await client.connect();
    let cursor =  client.db('IT-project').collection('MinifigAndSet').find({});
    let result = await cursor.toArray();
    await client.close();
    res.render('legomasters/overzicht.ejs', { title: 'LegoMasters | Overzicht', result });
});

app.post('/legomasters/overzicht/delete', async (req: any, res: any) => {
    let result = await axios.get(`https://rebrickable.com/api/v3/lego/minifigs/${req.body.minifig}/?key=${process.env.API_KEY}`);
    await putInDb('Skipped', result.data);
    if (makeArrayDone === true) {
        await addToTwoSetList(result.data);
    }
    await client.db('IT-project').collection("MinifigAndSet").deleteOne({name: result.data.name});
    res.redirect('/legomasters/overzicht');
});

app.get('/legomasters/minifig/:minifigCode', async (req:any, res:any) => {
    await client.connect();
    let result = await client.db('IT-project').collection('MinifigAndSet').findOne({set_num:req.params.minifigCode});
    if (result == null) {
        result = await client.db('IT-project').collection('Blacklist').findOne({set_num:req.params.minifigCode});
    }
    await getArrayParts(result);
    await client.close();
    res.render('legomasters/minifig.ejs', { title: 'LegoMasters | Minifigs', result, arrayParts });
    arrayParts = [];
});

app.get('/legomasters/set/:setCode', async (req:any, res:any) => {
    await client.connect();
    let cursor =  client.db('IT-project').collection('MinifigAndSet').find({selected_num:req.params.setCode});
    let result = await cursor.toArray();
    await client.close();
    res.render('legomasters/set.ejs', { title: 'LegoMasters | Set', result });
});

app.get(`/legomasters/blacklist`, async (req:any, res:any) => {
    await client.connect();
    let cursor =  client.db('IT-project').collection('Blacklist').find({});
    let result = await cursor.toArray();
    await client.close();
    res.render('legomasters/overzichtBlacklist.ejs', { title: 'LegoMasters | Blacklist', result});
});

app.post('/legomasters/blacklist/reason', async (req:any, res:any) => {
    await client.connect();
    await client.db('IT-project').collection('Blacklist').updateOne({name:req.body.name}, {$set:{reason:req.body.reason}});
    await client.close();
    res.redirect('/legomasters/blacklist');
});

app.get('/legomasters/reset', async (req: any, res: any) => {
    await resetDb();
    res.redirect('/legomasters/');
});

app.get('/reference', (req: any, res: any) => {
    res.render('reference.ejs', { title: 'IT Project | References'});
});

app.use(function (req: any, res: any) {
    res.status(404).render('404.ejs');
});

app.listen(app.get('port'), () => console.log('[server] http://localhost:' + app.get('port')));
