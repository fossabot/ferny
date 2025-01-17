/*
.##.....##....###....####.##....##
.###...###...##.##....##..###...##
.####.####..##...##...##..####..##
.##.###.##.##.....##..##..##.##.##
.##.....##.#########..##..##..####
.##.....##.##.....##..##..##...###
.##.....##.##.....##.####.##....##
*/

const { ipcRenderer } = require('electron');
const ppath = require('persist-path')('Ferny');
const fs = require("fs");

/*
.########.##.....##.##....##..######..########.####..#######..##....##..######.
.##.......##.....##.###...##.##....##....##.....##..##.....##.###...##.##....##
.##.......##.....##.####..##.##..........##.....##..##.....##.####..##.##......
.######...##.....##.##.##.##.##..........##.....##..##.....##.##.##.##..######.
.##.......##.....##.##..####.##..........##.....##..##.....##.##..####.......##
.##.......##.....##.##...###.##....##....##.....##..##.....##.##...###.##....##
.##........#######..##....##..######.....##....####..#######..##....##..######.
*/

function requestBookmarksBar(on, layout) {
  if(on != null) {
    if(on) {
      on = 1;
    } else {
      on = 0;
    }
  }

  let Data = {
    on: on,
    layout: layout
  };

  ipcRenderer.send('request-set-bookmarks-bar', Data);
}

function scrollToId(id) {
  document.getElementById(id).scrollIntoView({
	  	behavior: 'smooth'
	});
}

function requestSearchEngine(engine) {
  ipcRenderer.send('request-set-search-engine', engine);
}

function requestTheme(color) {
  ipcRenderer.send('request-change-theme', color);
}

function requestBorderRadius(size) {
  ipcRenderer.send('request-change-border-radius', size);
}

function changeBorderRadius(size) {
  document.documentElement.style.setProperty('--px-radius', size + 'px');
}

function changeTheme(color) {
  if(checkIfDark(color)) {
    setIconsStyle('light');

    document.documentElement.style.setProperty('--color-top', 'white');
    document.documentElement.style.setProperty('--color-over', 'rgba(0, 0, 0, 0.3)');
  } else {
    setIconsStyle('dark');

    document.documentElement.style.setProperty('--color-top', 'black');
    document.documentElement.style.setProperty('--color-over', 'rgba(0, 0, 0, 0.1)');
  }
}

function setIconsStyle(str) {
  var icons = document.getElementsByClassName('theme-icon');

  for(var i = 0; i < icons.length; i++) {
    icons[i].src = "../themes/" + str + "/icons/" + icons[i].name + ".png";
  }
}

function checkIfDark(color) {
    var r, g, b, hsp;
    if (String(color).match(/^rgb/)) {
        color = String(color).match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);

        r = color[1];
        g = color[2];
        b = color[3];
    } else {
        color = +("0x" + color.slice(1).replace(
        color.length < 5 && /./g, '$&$&'));

        r = color >> 16;
        g = color >> 8 & 255;
        b = color & 255;
    }

    hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));

    if (hsp > 127.5) {
        return false;
    } else {
        return true;
    }
}

function loadTheme() {
  try {
    var themeColor = fs.readFileSync(ppath + "\\json\\theme.json");
    changeTheme(themeColor);
  } catch (e) {

  }
}

function changeWelcome(bool) {
  if(bool) {
    fs.writeFileSync(ppath + "\\json\\welcome.json", 1);
  } else {
    fs.writeFileSync(ppath + "\\json\\welcome.json", 0);
  }
}

function loadStartPage() {
  try {
    var startPage = fs.readFileSync(ppath + "\\json\\startpage.json");
    document.getElementById('start-page-input').value = startPage;
  } catch (e) {

  }
}

function loadHomePage() {
  try {
    var jsonstr = fs.readFileSync(ppath + "\\json\\home.json");
    Data = JSON.parse(jsonstr);
    document.getElementById('home-page-input').value = Data.url;
    if(Data.on == 1) {
      document.getElementById('home-page-checkbox').checked = true;
    }
  } catch (e) {

  }
}

function saveHomePage() {
  var url = document.getElementById('home-page-input').value;
  var on = document.getElementById('home-page-checkbox').checked;

  if(url.length <= 0) {
    notif("First enter the home page URL", "warning");
  } else {
    if(on) {
      on = 1;
    } else {
      on = 0;
    }
  
    if(!fs.existsSync(ppath + "\\json")) {
      fs.mkdirSync(ppath + "\\json");
    } 
    fs.writeFileSync(ppath + "\\json\\home.json", JSON.stringify({ url: url, on: on }));

    notif("Home page saved", "success");

    ipcRenderer.send('request-update-home-page');
  }
}

function loadSearchEngine() {
  try {
    var searchEngine = fs.readFileSync(ppath + "\\json\\searchengine.json");

    var radios = document.getElementsByName("search-engine");
    for(var i = 0; i < radios.length; i++) {
      if(radios[i].value == searchEngine) {
        radios[i].checked = true;
        break;
      }
    }
  } catch (e) {

  }
}

function loadBorderRadius() {
  try {
    var borderRadius = fs.readFileSync(ppath + "\\json\\radius.json");
    changeBorderRadius(borderRadius);

    var radios = document.getElementsByName("border-radius");
    for(var i = 0; i < radios.length; i++) {
      if(radios[i].value == borderRadius) {
        radios[i].checked = true;
        break;
      }
    }
  } catch (e) {

  }
}

function showWelcomeScreen() {
  ipcRenderer.send("request-show-welcome-screen");
}

function saveStartPage() {
  var url = document.getElementById('start-page-input').value;

  fs.writeFileSync(ppath + "\\json\\startPage.json", url);

  notif("Start page saved: " + url, "success");
}

function notif(text, type) {
  let Data = {
    text: text,
    type: type
  };
  ipcRenderer.send('request-notif', Data)
}

function moreInfo(btn) {
  btn.classList.toggle('active');
  btn.nextElementSibling.classList.toggle('active');
}

function loadWelcome() {
  try {
    var welcomeOn = fs.readFileSync(ppath + "\\json\\welcome.json");
    if(welcomeOn == 1) {
      document.getElementById('welcome-checkbox').checked = true;
    } else {
      document.getElementById('welcome-checkbox').checked = false;
    }
  } catch (e) {

  }
}

function loadBookmarksBar() {
  try {
    var jsonstr = fs.readFileSync(ppath + "\\json\\bookmarksbar.json");
    let Data = JSON.parse(jsonstr);

    if(Data.on) {
      document.getElementById('bookmarks-bar-checkbox').checked = true;
    }

    var radios = document.getElementsByName("bbar-layout");
    for(var i = 0; i < radios.length; i++) {
      if(radios[i].value == Data.layout) {
        radios[i].checked = true;
        break;
      }
    }
  } catch (e) {

  }
}

function loadCache() {
  ipcRenderer.send('request-set-cache-size');
}

function bytesToSize(bytes) {
  var sizes = ['bytes', 'Kb', 'Mb', 'Gb', 'Tb'];
  if (bytes == 0) return '0 Byte';
  var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

function clearBrowsingData() {
  // var clearHistory = document.getElementById('clear-history-checkbox').checked;
  var clearCache = document.getElementById('clear-cache-checkbox').checked;
  var clearStorage = document.getElementById('clear-storage-checkbox').checked;
  // var clearAuth = document.getElementById('clear-auth-checkbox').checked;

  // if(clearHistory) {
  //   try {
  //     fs.writeFileSync(ppath + "\\json\\history.json", "");
  //   } catch (error) {
  
  //   }
  // }

  let Data = {
    cache: clearCache,
    storage: clearStorage
    // auth: clearAuth
  };

  ipcRenderer.send('request-clear-browsing-data', Data);
}

function setStartPageLikeHomePage() {
  try {
    var jsonstr = fs.readFileSync(ppath + "\\json\\home.json");
    Data = JSON.parse(jsonstr);
    document.getElementById('start-page-input').value = Data.url;
  } catch (e) {

  }
}

/*
.####.########...######.....########..########.##....##.########..########.########..########.########.
..##..##.....##.##....##....##.....##.##.......###...##.##.....##.##.......##.....##.##.......##.....##
..##..##.....##.##..........##.....##.##.......####..##.##.....##.##.......##.....##.##.......##.....##
..##..########..##..........########..######...##.##.##.##.....##.######...########..######...########.
..##..##........##..........##...##...##.......##..####.##.....##.##.......##...##...##.......##...##..
..##..##........##....##....##....##..##.......##...###.##.....##.##.......##....##..##.......##....##.
.####.##.........######.....##.....##.########.##....##.########..########.##.....##.########.##.....##
*/

ipcRenderer.on('action-load-theme', (event, arg) => {
  loadTheme();
});

ipcRenderer.on('action-load-border-radius', (event, arg) => {
  loadBorderRadius();
});

ipcRenderer.on('action-set-cache-size', (event, arg) => {
  document.getElementById('cache-size-label').innerHTML = "Cache size: " + bytesToSize(arg.cacheSize);
});

/*
.####.##....##.####.########
..##..###...##..##.....##...
..##..####..##..##.....##...
..##..##.##.##..##.....##...
..##..##..####..##.....##...
..##..##...###..##.....##...
.####.##....##.####....##...
*/

function init() {
  loadTheme();
  loadBorderRadius();
  loadBookmarksBar();
  loadStartPage();
  loadHomePage();
  loadSearchEngine();
  loadCache();
  loadWelcome();
}

document.onreadystatechange = () => {
  if (document.readyState == "complete") {
      init();
  }
}

/*
.########.##.....##.########....########.##....##.########.
....##....##.....##.##..........##.......###...##.##.....##
....##....##.....##.##..........##.......####..##.##.....##
....##....#########.######......######...##.##.##.##.....##
....##....##.....##.##..........##.......##..####.##.....##
....##....##.....##.##..........##.......##...###.##.....##
....##....##.....##.########....########.##....##.########.
*/