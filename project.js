// node project.js --url="https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results" --dest="teams.csv" --folderName="data" 

let minimist = require('minimist');
let axios = require('axios');
let fs = require('fs');
let excel = require('excel4node');
let pdf = require('pdf-lib');
let jsdom = require('jsdom');
let path = require('path');

let args = minimist(process.argv);

//proces html and create matches.json
writeMatchesJson(args.url);

//create teams.json using matches.json
let matchesJSON = fs.readFileSync('matches.json', 'utf-8');
let matches = JSON.parse(matchesJSON);
writeTeamsJson(matches);

//writing excel file using teams.json
let teamsJSON = fs.readFileSync('teams.json', 'utf-8');
let teams = JSON.parse(teamsJSON);
writeExcelFile(teams, args.dest);

//create folders and score cards
createFolders(teams, args.folderName);

function createFolders (teams, folderName){
    fs.rmdirSync(folderName, {recursive: true, force : true});
    fs.mkdirSync(folderName);

    for(let i = 0; i < teams.length; i++){
        let folder = path.join(folderName, teams[i].name);
        fs.mkdirSync(folder);

        for(let j = 0; j < teams[i].matches.length; j++){
            createScoreCard(teams[i].matches[j].vs, teams[i].name, teams[i].matches[j], folderName);
        }
    }
}

function createScoreCard(oppName, teamName, matchInfo, rootFolder){
    let templateBytes = fs.readFileSync('template.pdf');
    let pdfDoc = pdf.PDFDocument.load(templateBytes);

    pdfDoc.then(function(pdf){
        let page = pdf.getPage(0);

        page.drawText(teamName, {
            x: 315,
            y: 727,
            size: 9
        });

        page.drawText(oppName, {
            x: 315,
            y: 713,
            size: 9    
        });

        page.drawText(matchInfo.selfScore, {
            x: 315,
            y: 699,
            size: 9
        });

        page.drawText(matchInfo.oppScore, {
            x: 315,
            y: 685,
            size: 9
        });

        page.drawText(matchInfo.result, {
            x: 295
            y: 671,
            size: 9
        });
        
        let pdfBytes = pdf.save();

        pdfBytes.then(function(modifiedBytes){
            let fileName = path.join(rootFolder, teamName, oppName + ".pdf");
            let exists = true;
            let counter = 1;

            while(exists){
                if(fs.existsSync(fileName)){
                    fileName = path.join(rootFolder, teamName, oppName + "(" + counter + ")" + ".pdf");
                    counter++;
                } else {
                    fs.writeFileSync(fileName, modifiedBytes);
                    exists = false;
                    break;
                }
            }
            

        });
    });
}

function writeExcelFile(teams, fileName){
    let wb = new excel.Workbook();

    for(let i = 0; i < teams.length; i++){
        let ws = wb.addWorksheet(teams[i].name);

        ws.cell(1,1).string('Vs');
        ws.cell(1,2).string('Self Score');
        ws.cell(1,3).string('Opp Score');
        ws.cell(1,4).string('Result');

        for(let j = 0; j < teams[i].matches.length; j++){
            ws.cell(j+2,1).string(teams[i].matches[j].vs);
            ws.cell(j+2,2).string(teams[i].matches[j].selfScore);
            ws.cell(j+2,3).string(teams[i].matches[j].oppScore);
            ws.cell(j+2,4).string(teams[i].matches[j].result);
        }
    }

    wb.write(fileName);
}

function writeMatchesJson(url){
    let getHtml = axios.get(url);

    getHtml.then(function(response){
        let dom = new jsdom.JSDOM(response.data);
        let document = dom.window.document;

        let matchDivs = document.querySelectorAll('div.match-score-block');
        let matches = [];

        for(let i = 0; i < matchDivs.length; i++){
            let matchDiv = matchDivs[i];

            let match = {
                t1 : '',
                t2 : '',
                t1s : '',
                t2s : '',
                result : ''    
            }

            let teamNames = matchDiv.querySelectorAll('div.name-detail > p.name');
            match.t1 = teamNames[0].textContent;
            match.t2 = teamNames[1].textContent;

            let scoreDetail = matchDiv.querySelectorAll('div.score-detail > span.score');
            if(scoreDetail.length == 2){
                match.t1s = scoreDetail[0].textContent;
                match.t2s = scoreDetail[1].textContent;
            }else if (scoreDetail.length == 1){
                match.t1s = scoreDetail[0].textContent
            }

            let result = matchDiv.querySelectorAll('div.status-text > span');
            match.result = result[0].textContent;    
            
            matches.push(match);
        }
        
        fs.writeFileSync('matches.json', JSON.stringify(matches), 'utf-8');

    });
}

function writeTeamsJson(matches){
    let teams =[];

    for(let i = 0; i < matches.length; i++){
        let t1Index = -1;
        
        for(let j = 0; j < teams.length; j++){
            if(matches[i].t1 == teams[j].name){
                t1Index = j;
                break;
            }
        }

        if(t1Index == -1){
            teams.push({name : matches[i].t1,
                matches : []
            });
        }

        let t2Index = -1;

        for(let j = 0; j < teams.length; j++){
            if(matches[i].t2 == teams[j].name){
                t2Index = j;
                break;
            }
        }

        if(t2Index == -1){
            teams.push({name : matches[i].t2,
                matches : []
            });
        }
    }
    
    for(let i = 0; i < matches.length; i++){
        let t1Index = -1;
        
        for(let j = 0; j < teams.length; j++){
            if(matches[i].t1 == teams[j].name){
                t1Index = j;
                break;
            }
        }

        let team1 = teams[t1Index];
        team1.matches.push({
            vs : matches[i].t2,
            selfScore : matches[i].t1s,
            oppScore : matches[i].t2s,
            result : matches[i].result
        })

        let t2Index = -1;

        for(let j = 0; j < teams.length; j++){
            if(matches[i].t2 == teams[j].name){
                t2Index = j;
                break;
            }
        }

        let team2 = teams[t2Index];
        team2.matches.push({
            vs : matches[i].t1,
            selfScore : matches[i].t2s,
            oppScore : matches[i].t1s,
            result : matches[i].result
        });
    }
    
    fs.writeFileSync('teams.json', JSON.stringify(teams), 'utf-8');
}
