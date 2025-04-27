require('dotenv').config()
const express = require('express');
const useragent = require('express-useragent');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const log = require('./libs/logger');
const tools = require('./libs/tools');
const cache = require('./libs/cache');
const gitRepo = require('./libs/gitRepo');
const geoip = require('fast-geoip');
const repo = require('./libs/pixelItRepo');
const { apiLimiter, telemetryLimiter, saveBitmapLimiter } = require('./libs/rateLimit');

const port = process.env.PORT || 8080;
const telemetryUserCheck = process.env.TELEMETRY_USER_CHECK ? process.env.TELEMETRY_USER_CHECK.toUpperCase() == "TRUE" : false

// defining the Express app
const app = express();

app.use(useragent.express());
// adding Helmet to enhance your Rest API's security
app.use(helmet());
// using bodyParser to parse JSON bodies into JS objects
app.use(bodyParser.json());
// enabling CORS for all requests
app.use(cors());

app.use('/api/', apiLimiter);

app.get('/api/GetBMPByID/:id', async (req, res) => {
    const sourceIP = tools.getIPFromRequest(req);
    const rawUrl = tools.getRawURLFromRequest(req);
    const id = req.params.id;
    const uuid = req.query.uuid || '';

    if (tools.isNumeric(id) == false) {
        log.warn('{apiPath}: {id} is not a valid ID!', { apiPath: 'GetBMPByID', id, sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, uuid: uuid, });
        res.status(400).send('Not valid ID');
        return;
    }

    const bmp = (await cache.getOrSet(`GetBMPByID_${id}`, () => { return repo.getBMPByID(id) }, 0));

    if (!bmp) {
        log.warn('{apiPath}: BMP ID: {id} is not valide', { apiPath: 'GetBMPByID', id: id, sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, uuid: uuid, });
        res.status(400).send(`BMP ID: ${id} is not valide`);
        return;
    }

    log.info('{apiPath}: BMP with ID {id} and name {name} successfully delivered', { apiPath: 'GetBMPByID', id: bmp.id, name: bmp.name, sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, uuid: uuid, });
    res.send(bmp);
});

app.get('/api/GetBMPNewst', async (req, res) => {
    const sourceIP = tools.getIPFromRequest(req);
    const rawUrl = tools.getRawURLFromRequest(req);
    const uuid = req.query.uuid || '';
    const bmp = (await cache.getOrSet('GetBMPNewst', () => { return repo.getBMPNewst() }, 30)) ?? {};
    log.info('{apiPath} BMP with ID {id} and name {name} successfully delivered', { apiPath: 'GetBMPNewst', id: bmp.id, name: bmp.name, sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, uuid: uuid, });
    res.send(bmp);
});

app.get('/api/GetBMPAll', async (req, res) => {
    const sourceIP = tools.getIPFromRequest(req);
    const rawUrl = tools.getRawURLFromRequest(req);
    const uuid = req.query.uuid || '';
    const bmps = (await cache.getOrSet('GetBMPAll', () => { return repo.getBMPAll() }, 30)) ?? [];
    log.info('{apiPath}: {count} BMPs successfully delivered', { apiPath: 'GetBMPAll', count: bmps.length, sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, uuid: uuid, });
    res.send(bmps);
});

app.post('/api/Telemetry', telemetryLimiter, async (req, res) => {
    const sourceIP = tools.getIPFromRequest(req);
    const rawUrl = tools.getRawURLFromRequest(req);
    const client = tools.getClientFromRequest(req);

    if (!req.body) {
        log.error('{apiPath}: No body found', { apiPath: 'Telemetry', sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, client, });
        res.status(400).send('Not valid body');
        return;
    }

    if (!req.body.uuid || req.body.uuid.length != 40) {
        log.error('{apiPath}: UUID is not valide', { apiPath: 'Telemetry', sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, client, });
        res.status(400).send('Not valid body');
        return;
    }

    (async () => {
        req.body.geoip = await geoip.lookup(sourceIP);
        log.info(`{apiPath}: ${JSON.stringify(req.body)}`, { apiPath: 'Telemetry', sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, client, });
        repo.saveTelemetry(req.body);
    })();

    res.sendStatus(200);
});

app.get(['/api/UserMap', '/api/UserMapData'], async (req, res) => {
    const sourceIP = tools.getIPFromRequest(req);
    const rawUrl = tools.getRawURLFromRequest(req);
    const uuid = req.query.uuid || '';

    if (telemetryUserCheck == true) {
        const isTelemetryUser = (await cache.getOrSet(`IsTelemetryUser_UUID:${uuid}`, () => { return repo.isTelemetryUser(uuid) }, 30)) ?? {};

        if (!isTelemetryUser && isTelemetryUser == false) {
            res.send({ coords: [], error: { telemetryUser: false } });
            log.info('{apiPath}: UserMap NOT delivered, reason: no telemetry user!', { apiPath: 'UserMap', sourceIP, rawUrl, useragent: req.useragent, uuid: uuid, rateLimit: req.rateLimit, });
            return;
        }
    }

    const userMapData = (await cache.getOrSet('UserMap', () => { return repo.getUserMapData() }, 30)) ?? [];

    log.info('{apiPath}: UserMap ({count} user) successfully delivered', { apiPath: 'UserMap', count: userMapData.length, sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, uuid: uuid, });
    res.send({ coords: userMapData });
});

app.get('/api/Statistics', async (req, res) => {
    const sourceIP = tools.getIPFromRequest(req);
    const rawUrl = tools.getRawURLFromRequest(req);
    const uuid = req.query.uuid || '';

    if (telemetryUserCheck == true) {
        const isTelemetryUser = (await cache.getOrSet(`IsTelemetryUser_UUID:${uuid}`, () => { return repo.isTelemetryUser(uuid) }, 30)) ?? {};

        if (telemetryUserCheck == true && !isTelemetryUser && isTelemetryUser == false) {
            res.send({ error: { telemetryUser: false } });
            log.info('{apiPath}: Statistics NOT delivered, reason: no telemetry user!', { apiPath: 'Statistics', sourceIP, rawUrl, useragent: req.useragent, uuid: uuid, rateLimit: req.rateLimit, });
            return;
        }
    }

    const result = (await cache.getOrSet('Statistics', async () => {
        const releasesArray = (await cache.getOrSet('Releases', () => { return gitRepo.getGitReleases() }, 600)) ?? [];
        const officialBuilds = (await cache.getOrSet('OfficialBuilds', () => { return gitRepo.getOfficialBuilds() }, 600)) ?? [];
        const statistics = await repo.getStatistics()
        tools.cleanStats(releasesArray, statistics, officialBuilds);
        return statistics;
    }, 30)) ?? {};

    log.info('{apiPath}: Statistics successfully delivered', { apiPath: 'Statistics', sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, uuid: uuid, });
    res.send(result);
});

app.get('/api/LastVersion', async (req, res) => {
    const sourceIP = tools.getIPFromRequest(req);
    const rawUrl = tools.getRawURLFromRequest(req);
    const uuid = req.query.uuid || '';
    const releases = (await cache.getOrSet('Releases', () => { return gitRepo.getGitReleases() }, 600)) ?? [];
    let lastReleaseData = {};

    if (releases.length > 0) {
        lastReleaseData = releases.filter(x => x.prerelease == false)[0];
    }

    for (const key of ['downloads', 'downloadURL', 'fwdownloads', 'releaseNoteArray', 'readmeLink', 'date']) {
        delete lastReleaseData[key];
    }

    log.info('{apiPath}: Version {version} successfully delivered', { apiPath: 'LastVersion', version: lastReleaseData.version, sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, uuid: uuid, });

    res.send(lastReleaseData);
});

app.get('/api/LastRelease', async (req, res) => {
    const sourceIP = tools.getIPFromRequest(req);
    const rawUrl = tools.getRawURLFromRequest(req);
    const uuid = req.query.uuid || '';
    const releases = (await cache.getOrSet('Releases', () => { return gitRepo.getGitReleases() }, 600)) ?? [];
    let lastReleaseData = {};

    if (releases.length > 0) {
        // No pre-release and the latest release 
        lastReleaseData = releases.filter(x => x.prerelease == false)[0];
    }

    log.info('{apiPath}: Version {version} successfully delivered', { apiPath: 'LastRelease', version: lastReleaseData.version, sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, uuid: uuid, });


    res.send(lastReleaseData);
});

app.get('/api/OfficialReleases', async (req, res) => {
    const sourceIP = tools.getIPFromRequest(req);
    const rawUrl = tools.getRawURLFromRequest(req);
    const uuid = req.query.uuid || '';
    const releasesArray = (await cache.getOrSet('Releases', () => { return gitRepo.getGitReleases() }, 600)) ?? [];
    let data = { releases: [] };

    if (releasesArray.length > 0) {
        data.releases = releasesArray.map(x => x.version).filter(x => x != '');
    }

    log.info('{apiPath}: Version {versions} successfully delivered', { apiPath: 'OfficialReleases', versions: data.releases.map(value => value).join(', '), sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, uuid: uuid, });

    res.send(data);
});

app.get('/api/Releases', async (req, res) => {
    const sourceIP = tools.getIPFromRequest(req);
    const rawUrl = tools.getRawURLFromRequest(req);
    const uuid = req.query.uuid || '';
    let releases = await cache.getOrSet('Releases', () => { return gitRepo.getGitReleases() }, 600) ?? [];

    if (releases.length > 0) {
        // No pre-release and the latest 4 releases 
        releases = releases.filter(x => x.prerelease == false).slice(0, 4);
    }

    log.info('{apiPath}: Versions {versions} successfully delivered', { apiPath: 'Releases', versions: releases.map(value => value.version).join(', '), sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, uuid: uuid });

    res.send(releases);
});

app.post('/api/SaveBitmap', saveBitmapLimiter, async (req, res) => {
    const sourceIP = tools.getIPFromRequest(req);
    const rawUrl = tools.getRawURLFromRequest(req);
    const geoipData = await geoip.lookup(sourceIP);
    const client = tools.getClientFromRequest(req);
    const uuid = req.query.uuid || '';

    if (!req.body) {
        log.error('{apiPath}: No body found', { apiPath: 'SaveBitmap', sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, geoip: geoipData, client, uuid: uuid, });
        res.status(400).send('Not valid body');
        return;
    }

    (async () => {
        log.info(`{apiPath}: ${JSON.stringify(req.body)}`, { apiPath: 'SaveBitmap', sourceIP, rawUrl, useragent: req.useragent, rateLimit: req.rateLimit, geoip: geoipData, client, });
        repo.saveBMP(req.body);
    })();

    res.sendStatus(200);
});

// starting the server
app.listen(port, () => {
    log.info('API listening on port {port}', { port, });
	
	console.log('-----------------------------------');
    console.log('🚀 PixelIt.API запущено!');
    console.log(`🌐 Сервер слухає на порту: ${port}`);
    console.log(`📅 Час старту: ${new Date().toLocaleString()}`);
    console.log('-----------------------------------');
});
