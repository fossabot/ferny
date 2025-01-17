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
const TabGroup = require("electron-tabs");
const dragula = require("dragula");
const autoSuggest = require('google-autocomplete');
const isUrl = require('validate.io-uri');
const getAvColor = require('color.js');
const fs = require("fs");
const ppath = require('persist-path')('Ferny');

// const bookmarkDrag = dragula([document.getElementById('bookmarks-bar')], {
//   moves: function(el, container, handle) {
//     return !el.classList.contains('folder');
//   },
//   direction: "horizontal"
// });

// bookmarkDrag.on('drop', function(el, target, source, sibling) {
//   saveBookmarksBar();
// });

/*
.########....###....########...######.
....##......##.##...##.....##.##....##
....##.....##...##..##.....##.##......
....##....##.....##.########...######.
....##....#########.##.....##.......##
....##....##.....##.##.....##.##....##
....##....##.....##.########...######.
*/

let tabGroup = new TabGroup({
  newTab: {
    title: 'New Tab',
    active: true,
    webviewAttributes: {
      preload: "../js/webview.js",
      enableBlinkFeatures: false
    }
  },
  newTabButtonText: `<img title='New tab' name='create16' class='theme-icon' ondrop='newTabDrop(event)' ondragover='prevDef(event)'/>`,
  closeButtonText: "&nbsp;"
});
dragula([tabGroup.tabContainer], {
  direction: "horizontal"
});

tabGroup.on("tab-added", (tab, tabGroup) => {
  let webview = tab.webview;

  tab.tab.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    ipcRenderer.send('request-tab-menu', tab.id);
  }, false);

  tab.tab.addEventListener('dragenter', (e) => {
    e.preventDefault();
    tab.activate();
  });

  tab.tab.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  tab.tab.addEventListener('drop', (e) => {
    e.preventDefault();
    var textData = e.dataTransfer.getData("Text");
    if (textData) {
      tab.webview.loadURL(textData);
    } else if(e.dataTransfer.files.length > 0) {
      tab.webview.loadURL(e.dataTransfer.files[0].path);
    }
  });

  document.getElementById('search-input').value = "";
  document.getElementById('back-btn').classList.add('disable');
  document.getElementById('forward-btn').classList.add('disable');
  applyFindPanel();

  tab.on("active", (tab) => {
    document.getElementById('search-input').value = webview.getURL();
    applyFindPanel();
    if (webview.canGoBack()) {
      document.getElementById('back-btn').classList.remove('disable');
    } else {
      document.getElementById('back-btn').classList.add('disable');
    }
    if (webview.canGoForward()) {
      document.getElementById('forward-btn').classList.remove('disable');
    } else {
      document.getElementById('forward-btn').classList.add('disable');
    }
    if (webview.isLoading()) {
      document.getElementById('stop-btn').style.display = "";
      document.getElementById('refresh-btn').style.display = "none";
    } else {
      document.getElementById('stop-btn').style.display = "none";
      document.getElementById('refresh-btn').style.display = "";
    }
  });

  webview.addEventListener('update-target-url', (e) => {
    document.getElementById('target-url').innerHTML = e.url;
  });

  webview.addEventListener('new-window', (e) => {
    if(e.disposition == "background-tab") {
      tabGroup.addTab({
        title: 'New Background Tab',
        src: e.url,
        active: false,
        webviewAttributes: {
          preload: "../js/webview.js"
        }
      });
    } else {
      tabGroup.addTab({
        title: 'New Tab',
        src: e.url,
        active: true,
        webviewAttributes: {
          preload: "../js/webview.js"
        }
      });
    }
  });

  webview.addEventListener('page-favicon-updated', (e) => {
    tab.setIcon(e.favicons[0]);
    var img = tab.tab.getElementsByTagName('img')[0];
    var color = new getAvColor(img);
    color.mostUsed(result => {
      // tab.tab.style.backgroundImage = "linear-gradient(" + result[0] + ", var(--color-back), var(--color-back))"; 
      tab.tab.style.borderTop = "4px solid " + result[0];
    });
  });

  webview.addEventListener('page-title-updated', (e) => {
    tab.setTitle(e.title);
    var index = tab.getPosition(false);
    document.getElementsByClassName('etabs-tab')[index - 1].title = e.title;
  });

  webview.addEventListener('dom-ready', () => {
    webview.blur();
    webview.focus();
    applyFindPanel();
  });

  webview.addEventListener('did-start-loading', () => {
    document.getElementById("refresh-btn").style.display = "none";
    document.getElementById("stop-btn").style.display = "";
  });

  webview.addEventListener('did-stop-loading', () => {
    document.getElementById("refresh-btn").style.display = "";
    document.getElementById("stop-btn").style.display = "none";
  });

  webview.addEventListener('did-navigate', (e) => {
    document.getElementById('search-input').value = e.url;
    tab.setIcon("../imgs/gifs/page-loading.gif");

    if (webview.canGoBack()) {
      document.getElementById('back-btn').classList.remove('disable');
    } else {
      document.getElementById('back-btn').classList.add('disable');
    }
    if (webview.canGoForward()) {
      document.getElementById('forward-btn').classList.remove('disable');
    } else {
      document.getElementById('forward-btn').classList.add('disable');
    }
    
    ipcRenderer.send('request-add-history-item', e.url);
  });

  webview.addEventListener('did-navigate-in-page', (e) => {
    if (e.isMainFrame) {
      document.getElementById('search-input').value = e.url;
      if (webview.canGoBack()) {
        document.getElementById('back-btn').classList.remove('disable');
      } else {
        document.getElementById('back-btn').classList.add('disable');
      }
      if (webview.canGoForward()) {
        document.getElementById('forward-btn').classList.remove('disable');
      } else {
        document.getElementById('forward-btn').classList.add('disable');
      }
    }
  });

  webview.addEventListener('certificate-error', (e) => {
    notif("Certificate error", 'warning');
  });

  webview.addEventListener('enter-html-full-screen', (e) => {
    document.body.classList.add('fullscreen');
    notif("Press F11 to exit full screen", 'info');
  });

  webview.addEventListener('leave-html-full-screen', (e) => {
    document.body.classList.remove('fullscreen');
  });

  webview.addEventListener('did-fail-load', (e) => {
    if (webview.canGoBack()) {
      document.getElementById('back-btn').classList.remove('disable');
    } else {
      document.getElementById('back-btn').classList.add('disable');
    }
    if (webview.canGoForward()) {
      document.getElementById('forward-btn').classList.remove('disable');
    } else {
      document.getElementById('forward-btn').classList.add('disable');
    }

    notif("Connection failed: " + e.errorDescription + " (" + e.errorCode + ")", "error");
  });

  document.getElementsByClassName('etabs-tab-buttons')[tab.getPosition(false) - 1].title = "Close tab";
});

tabGroup.on("tab-removed", (tab, tabGroup) => {
  if (tabGroup.getTabs().length <= 0) {
    tabGroup.addTab();
  }
});

/*
.########.##.....##.##....##..######..########.####..#######..##....##..######.
.##.......##.....##.###...##.##....##....##.....##..##.....##.###...##.##....##
.##.......##.....##.####..##.##..........##.....##..##.....##.####..##.##......
.######...##.....##.##.##.##.##..........##.....##..##.....##.##.##.##..######.
.##.......##.....##.##..####.##..........##.....##..##.....##.##..####.......##
.##.......##.....##.##...###.##....##....##.....##..##.....##.##...###.##....##
.##........#######..##....##..######.....##....####..#######..##....##..######.
*/

function loadTheme() {
  var themeColor = "rgb(255, 255, 255)";
  
  try {
    themeColor = fs.readFileSync(ppath + "\\json\\theme.json");
  } catch (e) {
    if(!fs.existsSync(ppath + "\\json")) {
      fs.mkdirSync(ppath + "\\json");
    } 
    fs.writeFileSync(ppath + "\\json\\theme.json", themeColor);
  }

  applyTheme(themeColor);
}

function loadBorderRadius() {
  var borderRadius = '4';

  try {
    borderRadius = fs.readFileSync(ppath + "\\json\\radius.json");
  } catch (e) {
    if(!fs.existsSync(ppath + "\\json")) {
      fs.mkdirSync(ppath + "\\json");
    } 
    fs.writeFileSync(ppath + "\\json\\radius.json", borderRadius);
  }

  applyBorderRadius(borderRadius);
}

function saveSidebar() {
  var pin = document.body.classList.contains('pinned-sidebar');
  if(pin) {
    pin = 1;
  } else {
    pin = 0;
  }
  var collapse = document.body.classList.contains('collapse-sidebar');
  if(collapse) {
    collapse = 1;
  } else {
    collapse = 0;
  }

  let Data = {
    pin: pin,
    collapse: collapse
  };

  fs.writeFileSync(ppath + "\\json\\sidebar.json", JSON.stringify(Data));
}

function loadSidebar() {
  let Data = {
    pin: 0,
    collapse: 0
  };

  try {
    var jsonstr = fs.readFileSync(ppath + "\\json\\sidebar.json");
    Data = JSON.parse(jsonstr);
  } catch (e) {
    if(!fs.existsSync(ppath + "\\json")) {
      fs.mkdirSync(ppath + "\\json");
    } 
    fs.writeFileSync(ppath + "\\json\\sidebar.json", JSON.stringify(Data));
  }

  if(Data.pin == 1) {
    showSidebar();
    pinSidebar();
  }
  if(Data.collapse == 1) {
    document.body.classList.add('collapse-sidebar');
  }
}

function loadBookmarksBar() {
  let Data = {
    on: 0,
    layout: "all"
  };

  try {
    var jsonstr = fs.readFileSync(ppath + "\\json\\bookmarksbar.json");
    Data = JSON.parse(jsonstr);
  } catch (e) {
    if(!fs.existsSync(ppath + "\\json")) {
      fs.mkdirSync(ppath + "\\json");
    } 
    fs.writeFileSync(ppath + "\\json\\bookmarksbar.json", JSON.stringify(Data));
  }

  applyBookmarksBar(Data);
}

function applyBookmarksBar(arg) {
  if(arg.on == 1) {
    document.getElementById('bookmarks-bar').style.display = "";
    document.body.classList.add('bookmarks-bar');

    if(arg.layout == "only-icons") {
      document.getElementById('bookmarks-bar').classList.add("only-icons");
      document.getElementById('bookmarks-bar').classList.remove("only-labels");
    } else if(arg.layout == "only-labels") {
      document.getElementById('bookmarks-bar').classList.remove("only-icons");
      document.getElementById('bookmarks-bar').classList.add("only-labels");
    } else {
      document.getElementById('bookmarks-bar').classList.remove("only-icons");
      document.getElementById('bookmarks-bar').classList.remove("only-labels");
    }

    updateBookmarksBar();
  } else {
    document.getElementById('bookmarks-bar').style.display = "none";
    document.getElementById('bookmarks-bar').innerHTML = "";
    document.body.classList.remove('bookmarks-bar');
  }
}

function newTabDrop(e) {
  e.preventDefault();
  var textData = e.dataTransfer.getData("Text");
  if (textData) {
    tabGroup.addTab({
      title: 'New Tab',
      src: textData,
      active: true,
      webviewAttributes: {
        preload: "../js/webview.js"
      }
    });
  } else if(e.dataTransfer.files.length > 0) {
    for(var i = 0; i < e.dataTransfer.files.length; i++) {
      tabGroup.addTab({
        title: 'New Tab',
        src: e.dataTransfer.files[i].path,
        active: true,
        webviewAttributes: {
          preload: "../js/webview.js"
        }
      });
    }
  }
}

function prevDef(event) {
  event.preventDefault();
}

function popupInfoContextMenu() {
  ipcRenderer.send('request-info-contextmenu');
}

function popupHomeButtonContextMenu() {
  ipcRenderer.send('request-home-button-contextmenu');
}

function toggleSidebar() {
  if (document.getElementById("sidebar").style.display == "none") {
    showSidebar();
  } else {
    hideSidebar();
  }
}

function goBack() {
  tabGroup.getActiveTab().webview.goBack();
}

function goForward() {
  tabGroup.getActiveTab().webview.goForward();
}

function goReload() {
  tabGroup.getActiveTab().webview.reload();
}

function goStop() {
  tabGroup.getActiveTab().webview.stop();
}

function requestTabsList() {
  let arr = [];
  let tabs = document.getElementsByClassName('etabs-tab');
  for (var i = 0; i < tabs.length; i++) {
    arr.push({
      label: tabs[i].getElementsByClassName('etabs-tab-title')[0].innerHTML,
      active: tabs[i].classList.contains('active')
    });
  }
  ipcRenderer.send('request-tabs-list', arr);
}

function requestSideMenu() {
  ipcRenderer.send('request-side-menu');
}

function pinSidebar() {
  document.getElementById('pin-sidebar-btn').style.display = "none";
  document.getElementById('unpin-sidebar-btn').style.display = "";
  document.body.classList.add('pinned-sidebar');
  saveSidebar();
}

function unpinSidebar() {
  document.getElementById('pin-sidebar-btn').style.display = "";
  document.getElementById('unpin-sidebar-btn').style.display = "none";
  document.body.classList.remove('pinned-sidebar');
  saveSidebar();
}

function installUpdate() {
  ipcRenderer.send('request-install-update');
  removeNotifById('update-0');
}

function goToBookmarksTab() {
  var sidebarWebview = document.getElementById('sidebar-webview');
  sidebarWebview.stop();
  showSidebar();

  sidebarWebview.src = '../html/bookmarks.html';

  document.getElementById('bookmarks-btn').classList.add('active');
  document.getElementById('downloads-btn').classList.remove('active');
  document.getElementById('settings-btn').classList.remove('active');
  document.getElementById('about-btn').classList.remove('active');
  document.getElementById('history-btn').classList.remove('active');
}

function goToHistoryTab() {
  var sidebarWebview = document.getElementById('sidebar-webview');
  sidebarWebview.stop();
  showSidebar();

  sidebarWebview.src = '../html/history.html';

  document.getElementById('bookmarks-btn').classList.remove('active');
  document.getElementById('downloads-btn').classList.remove('active');
  document.getElementById('settings-btn').classList.remove('active');
  document.getElementById('about-btn').classList.remove('active');
  document.getElementById('history-btn').classList.add('active');
}

function goToAboutTab() {
  var sidebarWebview = document.getElementById('sidebar-webview');
  sidebarWebview.stop();
  showSidebar();

  sidebarWebview.src = '../html/about.html';

  document.getElementById('bookmarks-btn').classList.remove('active');
  document.getElementById('downloads-btn').classList.remove('active');
  document.getElementById('settings-btn').classList.remove('active');
  document.getElementById('about-btn').classList.add('active');
  document.getElementById('history-btn').classList.remove('active');
}

function goToSettingsTab(shortcutId) {
  var sidebarWebview = document.getElementById('sidebar-webview');
  sidebarWebview.stop();
  showSidebar();

  if(shortcutId != null) {
    sidebarWebview.src = '../html/settings.html#' + shortcutId;
  } else {
    sidebarWebview.src = '../html/settings.html';
  }

  document.getElementById('bookmarks-btn').classList.remove('active');
  document.getElementById('downloads-btn').classList.remove('active');
  document.getElementById('settings-btn').classList.add('active');
  document.getElementById('about-btn').classList.remove('active');
  document.getElementById('history-btn').classList.remove('active');
}

function goToDownloadsTab() {
  var sidebarWebview = document.getElementById('sidebar-webview');
  sidebarWebview.stop();
  showSidebar();

  sidebarWebview.src = '../html/downloads.html';

  document.getElementById('bookmarks-btn').classList.remove('active');
  document.getElementById('downloads-btn').classList.add('active');
  document.getElementById('settings-btn').classList.remove('active');
  document.getElementById('about-btn').classList.remove('active');
  document.getElementById('history-btn').classList.remove('active');
}

function createBookmark(url, name, folder) {
  let Data = {
    name: name,
    url: url,
    folder: folder
  };

  var arr = [];
  try {
    var jsonstr = fs.readFileSync(ppath + "\\json\\bookmarks.json");
    arr = JSON.parse(jsonstr);
  } catch (e) {

  }

  arr.push(Data);

  fs.writeFileSync(ppath + "\\json\\bookmarks.json", JSON.stringify(arr));

  document.getElementById('sidebar-webview').send('action-update-bookmarks');

  notif("Bookmark added", "info");

  updateBookmarksBar();
}

function searchWith(text, engine) {
  if(text == null) {
    var suggestions = document.getElementById('search-suggest-container').childNodes;
    var i = 0;
    while (i < suggestions.length && !suggestions[i].classList.contains('active')) {
      i++;
    }
    text = suggestions[i].value;
  }

  removeSuggestions();

  switch (engine) {
    case 'google':
      tabGroup.getActiveTab().webview.loadURL("https://google.com/search?q=" + text);
      break;
    case 'bing':
      tabGroup.getActiveTab().webview.loadURL("https://bing.com/search?q=" + text);
      break;
    case 'duckduckgo':
      tabGroup.getActiveTab().webview.loadURL("https://duckduckgo.com/?q=" + text);
      break;
    case 'yahoo':
      tabGroup.getActiveTab().webview.loadURL("https://search.yahoo.com/search?p=" + text);
      break;
    case 'wikipedia':
      tabGroup.getActiveTab().webview.loadURL("https://wikipedia.org/wiki/Special:Search?search=" + text);
      break;
    case 'yandex':
      tabGroup.getActiveTab().webview.loadURL("https://yandex.com/search/?text=" + text);
      break;
    case 'mailru':
      tabGroup.getActiveTab().webview.loadURL("https://go.mail.ru/search?q=" + text);
      break;
    case 'baidu':
      tabGroup.getActiveTab().webview.loadURL("https://www.baidu.com/s?wd=" + text);
      break;
    case 'naver':
      tabGroup.getActiveTab().webview.loadURL("https://search.naver.com/search.naver?query=" + text);
      break;
    case 'qwant':
      tabGroup.getActiveTab().webview.loadURL("https://www.qwant.com/?q=" + text);
      break;
    case 'youtube':
      tabGroup.getActiveTab().webview.loadURL("https://www.youtube.com/results?search_query=" + text);
      break;
  }
}

function navigateSuggest(text) {
  if(isUrl(text)) {
    tabGroup.getActiveTab().webview.loadURL(text);
  } else {
    var engines = document.getElementsByClassName('search-engine');
    for(var i = 0; i < engines.length; i++) {
      if(engines[i].classList.contains('active')) {
        searchWith(text, engines[i].name);
        break;
      }
    }
  }
}

function removeSuggestions() {
  setTimeout(function () {
    var suggest = document.getElementById('search-suggest');
    suggest.classList.add("hide");
    setTimeout(function () {
      suggest.style.display = "none";
      // document.getElementById('search-suggest-container').innerHTML = "";
    }, 250);
  }, 150);
}

function getSuggestions() {
  var input = document.getElementById('search-input');
  var suggest = document.getElementById('search-suggest');
  var container = document.getElementById('search-suggest-container');

  suggest.style.display = "";
  suggest.classList.remove("hide");

  container.innerHTML = "<input class='active' type='button' value='" + input.value + "' onclick='navigateSuggest(this.value)' />";

  if (input.value.length > 0) {
    autoSuggest.getQuerySuggestions(input.value, function (err, suggestions) {
      if (suggestions != null && suggestions.length > 0) {
        if (container.childNodes.length < 5) {
          for (var i = 0; i < 5; i++) {
            if (suggestions[i] != null) {
              var button = "<input type='button' value='" + suggestions[i].suggestion + "' onclick='navigateSuggest(this.value)' />";
              container.innerHTML += button;
            }
          }
        }
      }
    });
  } else {
    removeSuggestions();
  }
}

function notif(text, type) {
  var div = document.createElement('div');
  div.classList.add('notif');
  div.classList.add(type);
  div.innerHTML = "<div class='notif-body'><label class='notif-text'>" + text + "</label><img class='notif-close theme-icon' onclick='removeNotif(this.parentNode.parentNode)' title='Close notification' name='cancel'></div>";

  var notifPanel = document.getElementById('notif-panel');

  div.addEventListener('auxclick', (e) => {
    e.preventDefault();
      if(e.which == 2) {
        notifPanel.removeChild(div);
      }
  }, false);

  var img = document.createElement('img');
  img.classList.add('notif-icon', 'theme-icon');

  switch (type) {
    case "success":
      div.title = 'Success notification';
      img.name = 'check';
      break;
    case "info":
      div.title = 'Info notification';
      img.name = 'info';
      break;
    case "warning":
      div.title = 'Warning notification';
      img.name = 'warning';
      break;
    case "error":
      div.title = 'Error notification';
      img.name = 'fire';
  }
  div.insertBefore(img, div.children[0]);

  notifPanel.insertBefore(div, notifPanel.firstChild);

  applyTheme(document.documentElement.style.getPropertyValue('--color-back'));

  if (notifPanel.childNodes.length > 5) {
    for(var i = notifPanel.childNodes.length; i > 5; i--) {
      notifPanel.removeChild(notifPanel.lastChild);
    }
  }

  setTimeout(function () {
    removeNotif(div);
  }, 5000);
}

function quest(text, ops) {
  var div = document.createElement('div');
  div.classList.add('notif');
  div.classList.add('quest');
  div.innerHTML = ` <img name='question' class='notif-icon theme-icon'>
                    <div class='notif-body'>
                      <label class='notif-text'>` + text + `</label>
                      <img class='notif-close theme-icon' onclick='removeNotif(this.parentNode.parentNode)' title='Close notification' name='cancel'>
                      <hr>
                    </div>`;

  var notifPanel = document.getElementById('notif-panel');

  for (var i = 0; i < ops.length; i++) {
    var btn = document.createElement('div');
    btn.classList.add('nav-btn');
    btn.innerHTML = "<img name='" + ops[i].icon + "' class='theme-icon'><label>" + ops[i].text + "</label>";
    let j = i;
    btn.onclick = function () {
      eval(ops[j].click);
    };
    div.getElementsByClassName('notif-body')[0].appendChild(btn);
  }

  document.getElementById('notif-panel').appendChild(div);

  applyTheme(document.documentElement.style.getPropertyValue('--color-back'));

  if (notifPanel.childNodes.length > 5) {
    for(var i = notifPanel.childNodes.length; i > 5; i--) {
      notifPanel.removeChild(notifPanel.lastChild);
    }
  }
}

function updateLoader(percent, id) {
  var div = document.getElementById(id);
  if(typeof(div) != "undefined") {
    var bar = div.childNodes[1].getElementsByClassName('notif-bar')[0];
    var line = bar.getElementsByTagName('div')[0];
    var label = bar.getElementsByTagName('label')[0];

    line.style.width = (percent / 100 * bar.clientWidth) + "px";

    label.innerHTML = percent + "%";
  }
}

function loader(text, id) {
  var notifPanel = document.getElementById('notif-panel');

  var div = document.createElement('div');
  div.id = id;
  div.classList.add('notif');
  div.classList.add('loader');
  div.innerHTML = "<img name='download' class='notif-icon theme-icon'><div class='notif-body'><label class='notif-text'>" + text + "</label><img class='notif-close theme-icon' onclick='removeNotif(this.parentNode.parentNode)' title='Close notification' name='cancel'></div>";

  var bar = document.createElement('div');
  bar.classList.add('notif-bar');
  bar.innerHTML = "<div style='width: 0px;'></div><label>Loading...</label>";
  div.childNodes[1].appendChild(bar);

  notifPanel.appendChild(div);

  applyTheme(document.documentElement.style.getPropertyValue('--color-back'));

  if (notifPanel.childNodes.length > 5) {
    for(var i = notifPanel.childNodes.length; i > 5; i--) {
      notifPanel.removeChild(notifPanel.lastChild);
    }
  }
}

function removeNotif(div) {
  if(typeof(div) != "undefined") {
    div.classList.add('closed');
    setTimeout(function () {
      document.getElementById('notif-panel').removeChild(div);
    }, 250);
  }
}

function removeNotifById(id) {
  var div = document.getElementById(id);
  if(typeof(div) != "undefined") {
    div.classList.add('closed');
    setTimeout(function () {
      document.getElementById('notif-panel').removeChild(div);
    }, 250);
  }
}

function setIconsStyle(str) {
  var icons = document.getElementsByClassName('theme-icon');

  for (var i = 0; i < icons.length; i++) {
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

function applyTheme(color) {
  document.documentElement.style.setProperty('--color-back', color);

  if (checkIfDark(color)) {
    setIconsStyle('light');

    document.documentElement.style.setProperty('--color-top', 'white');
    document.documentElement.style.setProperty('--color-over', 'rgba(0, 0, 0, 0.3)');
  } else {
    setIconsStyle('dark');

    document.documentElement.style.setProperty('--color-top', 'black');
    document.documentElement.style.setProperty('--color-over', 'rgba(0, 0, 0, 0.1)');
  }

  try {
    document.getElementById('sidebar-webview').send('action-load-theme');
  } catch(e) {

  }
}

function applyBorderRadius(size) {
  document.documentElement.style.setProperty('--px-radius', size + 'px');

  try {
    document.getElementById('sidebar-webview').send('action-load-border-radius');
  } catch(e) {
    
  }
}

function showSidebar() {
  document.getElementById("sidebar-btn").classList.add('active');
  document.getElementById('sidebar').style.display = "";
  document.getElementById('sidebar').classList.remove('hide');

  // document.getElementById('sidebar-webview').openDevTools();
}

function hideSidebar() {
  document.getElementById('sidebar').classList.add('hide');
  setTimeout(function() {
    document.getElementById('sidebar').style.display = "none";
    unpinSidebar();
    document.getElementById("sidebar-btn").classList.remove('active');
  }, 250);
}

function checkForUpdates() {
  ipcRenderer.send('request-check-for-updates');
}

function exitAppAnyway() {
  ipcRenderer.send('request-exit-app-anyway');
}

function esc() {
  removeSuggestions();
  closeFindPanel();
  hideSidebar();
}

function showFindPanel() {
  document.getElementById("find-panel").style.display = "";
  document.getElementById('find-panel').classList.remove('hide');
  document.getElementById("find-input").select();

  document.body.classList.add('find');

  nextFindInPage();
}

function closeFindPanel() {
  document.getElementById('find-panel').classList.add('hide');

  setTimeout(function() {
    document.getElementById('find-panel').style.display = "none";
    document.body.classList.remove('find');
    tabGroup.getActiveTab().webview.stopFindInPage("keepSelection");
  }, 250);
}

function nextFindInPage() {
  var text = document.getElementById('find-input').value;
  if (text.length > 0) {
    tabGroup.getActiveTab().webview.findInPage(text);
  } else {
    tabGroup.getActiveTab().webview.stopFindInPage("keepSelection");
  }
}

function previousFindInPage() {
  var text = document.getElementById('find-input').value;
  if (text.length > 0) {
    tabGroup.getActiveTab().webview.findInPage(text, {
      forward: false
    });
  } else {
    tabGroup.getActiveTab().webview.stopFindInPage("keepSelection");
  }
}

function applyFindPanel() {
  var status = document.getElementById("find-panel").style.display;
  if (status == "") {
    showFindPanel();
  } else {
    closeFindPanel();
  }
}

function maximizeWindow() {
  ipcRenderer.send('request-maximize-window');
}

function minimizeWindow() {
  ipcRenderer.send('request-minimize-window');
}

function restoreWindow() {
  ipcRenderer.send('request-unmaximize-window');
}

function closeWindow() {
  ipcRenderer.send('request-quit-app');
}

function searchKeyUp(event) {
  event.preventDefault();
  if (document.getElementById("search-input").value.length > 0) {
    if (event.keyCode === 13) {
      var suggestions = document.getElementById('search-suggest-container').childNodes;
      var i = 0;
      while (i < suggestions.length && !suggestions[i].classList.contains('active')) {
        i++;
      }
      navigateSuggest(suggestions[i].value);
    }
    if (event.keyCode === 40) {
      var suggestions = document.getElementById('search-suggest-container').childNodes;
      var i = 0;
      while (i < suggestions.length && !suggestions[i].classList.contains('active')) {
        i++;
      }
      if (i < suggestions.length - 1) {
        document.getElementById('search-input').value = suggestions[i].nextSibling.value;
        suggestions[i].classList.remove('active');
        suggestions[i].nextSibling.classList.add('active');
      }
    }
    if (event.keyCode === 38) {
      var suggestions = document.getElementById('search-suggest-container').childNodes;
      var i = 0;
      while (i < suggestions.length && !suggestions[i].classList.contains('active')) {
        i++;
      }
      if (i > 0) {
        document.getElementById('search-input').value = suggestions[i].previousSibling.value;
        suggestions[i].classList.remove('active');
        suggestions[i].previousSibling.classList.add('active');
      }
    }
  }
}

function etabsTabsWheel(event) {
  var tabs = document.getElementById('etabs-tabs');
  if (event.deltaY < 0) {
   tabs.scrollLeft -= 40;
  }
  if (event.deltaY > 0) {
    tabs.scrollLeft += 40;
  }
}

function removeFolder(folder) {
  try {
    var jsonstr = fs.readFileSync(ppath + "\\json\\folders.json");
    var arr = JSON.parse(jsonstr);
    for (var i = 0; i < arr.length; i++) {
      if(arr[i].name == folder) {
        arr.splice(i, 1);
      }
    }
    fs.writeFileSync(ppath + "\\json\\folders.json", JSON.stringify(arr));

    document.getElementById('sidebar-webview').send('action-remove-folder', folder);
    updateBookmarksBar();

    notif("Folder removed: " + folder, "info");
  } catch (e) {

  }
}

function zoomNotif(zoom) {
  var div = document.createElement('div');
  div.id="zoom-1";
  div.classList.add('notif');
  div.classList.add('zoom');
  div.innerHTML = `<img name='search' class='notif-icon theme-icon'>
                    <div class='notif-body'>
                        <label class='notif-text'>Zoom factor changed to ` + zoom + `%</label>
                        <img class='notif-close theme-icon' onclick='removeNotif(this.parentNode.parentNode)' title='Close notification' name='cancel'>
                        <hr>
                        <div class="nav-btn" onclick="zoomOut()">
                            <img class="nav-btn-icon theme-icon" name="zoom-out">
                            <label class="nav-btn-label">Zoom out</label>
                        </div>
                        <div class="nav-btn" onclick="zoomIn()">
                            <img class="nav-btn-icon theme-icon" name="zoom-in">
                            <label class="nav-btn-label">Zoom in</label>
                        </div>
                    </div>`;

  var notifPanel = document.getElementById('notif-panel');

  notifPanel.insertBefore(div, notifPanel.firstChild);

  applyTheme(document.documentElement.style.getPropertyValue('--color-back'));

  if (notifPanel.childNodes.length > 5) {
    for(var i = notifPanel.childNodes.length; i > 5; i--) {
      notifPanel.removeChild(notifPanel.lastChild);
    }
  }

  setTimeout(function () {
    removeNotif(div);
  }, 5000);
}

function updateZoomNotif(zoom) {
  var div = document.getElementById('zoom-1');
  if(div != null) {
    div.getElementsByClassName('notif-text')[0].innerHTML = "Zoom factor changed to " + zoom + "%";
  } else {
    zoomNotif(zoom);
  }
}

function zoomIn() {
  var zoomFactor = tabGroup.getActiveTab().webview.getZoomFactor();
  if (zoomFactor < 2.5) {
    tabGroup.getActiveTab().webview.setZoomFactor(zoomFactor + 0.1);
    updateZoomNotif(Math.round((zoomFactor + 0.1) * 100));
    tabGroup.getActiveTab().webview.focus();
  }
}

function zoomOut() {
  var zoomFactor = tabGroup.getActiveTab().webview.getZoomFactor();
  if (zoomFactor > 0.3) {
    tabGroup.getActiveTab().webview.setZoomFactor(zoomFactor - 0.1);
    updateZoomNotif(Math.round((zoomFactor - 0.1) * 100));
    tabGroup.getActiveTab().webview.focus();
  }
}

function searchSuggestWheel(event) {
  if (event.deltaY < 0) {
    var suggestions = document.getElementById('search-suggest-container').childNodes;
    var i = 0;
    while (i < suggestions.length && !suggestions[i].classList.contains('active')) {
      i++;
    }
    if (i > 0) {
      document.getElementById('search-input').value = suggestions[i].previousSibling.value;
      suggestions[i].classList.remove('active');
      suggestions[i].previousSibling.classList.add('active');
    }
  }
  if (event.deltaY > 0) {
    var suggestions = document.getElementById('search-suggest-container').childNodes;
    var i = 0;
    while (i < suggestions.length && !suggestions[i].classList.contains('active')) {
      i++;
    }
    if (i < suggestions.length - 1) {
      document.getElementById('search-input').value = suggestions[i].nextSibling.value;
      suggestions[i].classList.remove('active');
      suggestions[i].nextSibling.classList.add('active');
    }
  }
}

function focusSearch() {
  let s = document.getElementById('search-input');
  s.focus();
  s.select();
}

function updateBookmarksBar() {
  var bbar = document.getElementById('bookmarks-bar');
  if(bbar.style.display != "none") {
    try {
      bbar.innerHTML = "";
      var jsonstr = fs.readFileSync(ppath + "\\json\\folders.json");
      var folders = JSON.parse(jsonstr);
      for (var i = 0; i < folders.length; i++) {
        addFolderToBookmarksBar(folders[i].name);
      }

      jsonstr = fs.readFileSync(ppath + "\\json\\bookmarks.json");
      var arr = JSON.parse(jsonstr);
      for (var i = 0; i < arr.length; i++) {
        checkIfHasFolder(arr[i].url, arr[i].name, arr[i].folder, folders, i);
      }
    } catch (e) {

    }
  }
}

function addFolderToBookmarksBar(name) {
  var bbar = document.getElementById('bookmarks-bar');

  var div = document.createElement('button');
  div.classList.add('folder');
  div.innerHTML = "<img class='folder-icon' src='../imgs/icons16/folder.png'><span>" + name + "</span><div class='folder-div'></div>";
  div.title = name;

  div.ondrop = (e) => {
    e.preventDefault();

    bbar.ondrop = (e) => {
      return false;
    }

    var textData = e.dataTransfer.getData("Text");
    if (textData) {
      createBookmark(textData, textData, name);
    }

    setTimeout(() => {
      bbar.ondrop = bookmarksBarDrop;
    }, 150);
  }

  // div.onfocus = () => {
  //   var folderDiv = div.getElementsByClassName('folder-div')[0];
  //   folderDiv.style.display = "block";
  // }

  // div.addEventListener('focusout', () => {
  //   if(div.getElementsByClassName('bookmark-div').length == 0) {
  //     div.getElementsByClassName('folder-div')[0].style.display = "none"; 
  //   }
  // });

  // div.addEventListener('contextmenu', (e) => {
  //   ipcRenderer.send('request-folder-contextmenu');
  // }, false);

  bbar.appendChild(div);
}

function checkIfHasFolder(url, name, folder, folders, index) {
  var bool = false;
  var folderIndex = 0;

  for(var i = 0; i < folders.length; i++) {
    if(folders[i].name == folder) {
      bool = true;
      folderIndex = i;
      break;
    }
  }

  var bbar = document.getElementById('bookmarks-bar');
  if(bool) {
    var elFolders = bbar.getElementsByClassName('folder-div');
    addBookmarkToBookmarksBar(url, name, elFolders[folderIndex], index);
  } else {
    addBookmarkToBookmarksBar(url, name, bbar, index);
  }
}

function addBookmarkToBookmarksBar(url, name, parent, index) {
  var div = document.createElement('div');
  div.classList.add('bookmark');
  div.title = name + "\n" + url;
  div.id = "bookmark-" + index;
  div.name = url;

  div.ondragstart = (e) => {
    e.dataTransfer.setData("text/plain", url);
  }

  div.onclick = () => {
    tabGroup.getActiveTab().webview.loadURL(url);
    return false;
  }

  div.addEventListener('contextmenu', (e) => {
    let contextData = {
      url: div.name,
      id: div.id
    };

    ipcRenderer.send('request-bookmark-contextmenu', contextData);
  }, false);

  div.addEventListener('auxclick', (e) => {
    e.preventDefault();
     if(e.which == 2) {
      tabGroup.addTab({
        title: 'New Tab',
        src: url,
        active: true,
        webviewAttributes: {
          preload: "../js/webview.js"
        }
      });
     }
  }, false);

  div.innerHTML = `<img class="bookmark-icon" src="` + 'http://www.google.com/s2/favicons?domain=' + url + `">
                  <span>` + name + `</span>`;

  parent.appendChild(div);
}

function bookmarksBarDrop(e) {
  e.preventDefault();
  var textData = e.dataTransfer.getData("Text");
  if (textData) {
    createBookmark(textData, textData, null);
  }
}

function loadHome() {
  let Data = {
    url: "https://duckduckgo.com",
    on: 0
  };

  try {
    var jsonstr = fs.readFileSync(ppath + "\\json\\home.json");
    Data = JSON.parse(jsonstr);
  } catch (e) {
    if(!fs.existsSync(ppath + "\\json")) {
      fs.mkdirSync(ppath + "\\json");
    } 
    fs.writeFileSync(ppath + "\\json\\home.json", JSON.stringify(Data));
  }

  var btn = document.getElementById('home-btn');
  if(Data.on == 1) {
    btn.style.display = "";
    btn.onclick = () => {
      goHome(Data.url);
    }
  } else {
    btn.style.display = "none";
  }
}

function goHome(url) {
  tabGroup.getActiveTab().webview.loadURL(url);
}

function copyText(arg) {
  var input = document.createElement('input');
  input.value = arg;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
}

function cancelPictureIn() {
  document.getElementById('picture-in-panel').classList.add('hide');

  setTimeout(function() {
    document.getElementById('picture-in-panel').style.display = "none";
  }, 250);
}

function saveBookmarksBar() {
  var bbar = document.getElementById('bookmarks-bar');

  var folders = bbar.getElementsByClassName('folder');
  var foldersArray = [];

  for(var i = 0; i < folders.length; i++) {
    let Data = {
      name: folders[i].getElementsByTagName('span')[0].innerHTML
    };
    foldersArray.push(Data);
  }

  fs.writeFileSync(ppath + "\\json\\folders.json", JSON.stringify(foldersArray));

  var bookmarks = bbar.getElementsByClassName('bookmark');
  var bookmarksArray = [];

  for(var i = 0; i < bookmarks.length; i++) {
    var folder = null;
    if (bookmarks[i].parentNode != bbar) {
      folder = bookmarks[i].parentNode.parentNode.getElementsByTagName('span')[0].innerHTML
    } 

    let Data = {
      url: bookmarks[i].name,
      name: bookmarks[i].getElementsByTagName('span')[0].innerHTML,
      folder: folder
    };
    bookmarksArray.push(Data);
  }

  fs.writeFileSync(ppath + "\\json\\bookmarks.json", JSON.stringify(bookmarksArray));

  document.getElementById('sidebar-webview').send('action-update-bookmarks');
}

async function pictureIn(url) {
  console.log("picture in: " + url);
  document.getElementById('picture-in-panel').classList.remove('hide');
  console.log("remove hide");
  document.getElementById('picture-in-panel').style.display = "";
  console.log("remove display none");
  var webview = document.getElementById('picture-in-webview').getWebContents();
  console.log("get web contents");
  webview.loadURL(url);
  console.log("load url");
}

function collapseSidebar() {
  document.body.classList.toggle('collapse-sidebar');
  saveSidebar();
}

function bookmarkAllTabs() {
  tabGroup.eachTab((currentTab, index, tabs) => {
    createBookmark(currentTab.webview.getURL(), currentTab.getTitle(), null);
  });
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

ipcRenderer.on('action-switch-tab', (event, arg) => {
  if(arg <= tabGroup.getTabs().length) {
    tabGroup.getTabByPosition(arg).activate();
  }
});

ipcRenderer.on('action-edit-bookmark', (event, arg) => {
  var div = document.getElementById(arg.id);

  if(div.getElementsByClassName('bookmark-div')[0] == null) {
    var nameLabel = div.getElementsByTagName('span')[0];

    div.onclick = function() { 
      return false;
    }
    div.title = "";
  
    var container = document.createElement('div');
    container.classList.add('bookmark-div');
  
    var inputName = document.createElement('input');
    inputName.type = "text";
    inputName.placeholder = "Bookmark name";
    inputName.classList.add('bookmark-name');
    inputName.value = nameLabel.innerHTML;
  
    var inputUrl = document.createElement('input');
    inputUrl.type = "text";
    inputUrl.placeholder = "Bookmark URL";
    inputUrl.classList.add('bookmark-url');
    inputUrl.value = arg.url;

    var saveButton = document.createElement('img');
    saveButton.classList.add('title-bar-btn', 'theme-icon');
    saveButton.name = "save";
    saveButton.title = "Save";
    saveButton.onclick = () => {
      div.title = inputName.value + "\n" + inputUrl.value;
      div.name = inputUrl.value;
      nameLabel.innerHTML = inputName.value;
      div.getElementsByClassName('bookmark-div')[0].classList.add('hide');
      setTimeout(() => {
        div.onclick = () => {
          tabGroup.getActiveTab().webview.loadURL(inputUrl.value);
        }
        div.removeChild(div.getElementsByClassName('bookmark-div')[0]);
        saveBookmarksBar();
      }, 250);
    }

    var deleteButton = document.createElement('img');
    deleteButton.classList.add('title-bar-btn', 'theme-icon');
    deleteButton.name = "delete";
    deleteButton.title = "Delete";
    deleteButton.onclick = () => {
      div.getElementsByClassName('bookmark-div')[0].classList.add('hide');
      setTimeout(() => {
        div.parentNode.removeChild(div);
        saveBookmarksBar();
      }, 250);
    }

    var cancelButton = document.createElement('img');
    cancelButton.classList.add('title-bar-btn', 'theme-icon');
    cancelButton.name = "cancel";
    cancelButton.title = "Cancel";
    cancelButton.onclick = () => {
      div.title = nameLabel.innerHTML + "\n" + arg.url;
      div.getElementsByClassName('bookmark-div')[0].classList.add('hide');
      setTimeout(() => {
        div.onclick = () => {
          tabGroup.getActiveTab().webview.loadURL(arg.url);
        }
        div.removeChild(div.getElementsByClassName('bookmark-div')[0]);
      }, 250);
    }
  
    container.appendChild(inputName);
    container.appendChild(inputUrl);
    container.appendChild(saveButton);
    container.appendChild(deleteButton);
    container.appendChild(cancelButton);
  
    div.appendChild(container);

    inputName.focus();

    var bounding = div.getElementsByClassName('bookmark-div')[0].getBoundingClientRect();
    if (bounding.left > (window.innerWidth / 2 || document.documentElement.clientWidth / 2)) {
      div.getElementsByClassName('bookmark-div')[0].style.left = "auto";
      div.getElementsByClassName('bookmark-div')[0].style.right = 0;
    }

    applyTheme(document.documentElement.style.getPropertyValue('--color-back'));
  }
});

ipcRenderer.on('action-sidebar-devtools', (event, arg) => {
  showSidebar();
  document.getElementById('sidebar-webview').openDevTools();
});

ipcRenderer.on('action-maximize-window', (event, arg) => {
  document.getElementById('drag-zone').classList.add('maximize');
  document.getElementById('max-btn').style.display = "none";
  document.getElementById('restore-btn').style.display = "";
});

ipcRenderer.on('action-unmaximize-window', (event, arg) => {
  document.getElementById('drag-zone').classList.remove('maximize');
  document.getElementById('max-btn').style.display = "";
  document.getElementById('restore-btn').style.display = "none";
});

ipcRenderer.on('action-set-bookmarks-bar', (event, arg) => {
  applyBookmarksBar(arg);
});

ipcRenderer.on('action-copy-text', (event, arg) => {
  copyText(arg);
});

ipcRenderer.on('action-update-home-page', (event, arg) => {
  loadHome();
});

ipcRenderer.on('action-tab-copyurl', (event, arg) => {
  var url = tabGroup.getActiveTab().webview.getURL();
  copyText(url);
});

ipcRenderer.on('action-tab-gohome', (event, arg) => {
  document.getElementById('home-btn').click();
});

ipcRenderer.on('action-tab-picturein', (event, arg) => {
  var url = tabGroup.getActiveTab().webview.getURL();
  pictureIn(url);
});

ipcRenderer.on('action-update-bookmarks-bar', (event, arg) => {
  updateBookmarksBar();
});

ipcRenderer.on('action-open-history', (event, arg) => {
  goToHistoryTab();
});

ipcRenderer.on('action-tab-newtab', (event, arg) => {
  tabGroup.addTab();
});
ipcRenderer.on('action-tab-reload', (event, arg) => {
  tabGroup.getActiveTab().webview.reload();
});
ipcRenderer.on('action-tab-back', (event, arg) => {
  tabGroup.getActiveTab().webview.goBack();
});
ipcRenderer.on('action-tab-forward', (event, arg) => {
  tabGroup.getActiveTab().webview.goForward();
});
ipcRenderer.on('action-tab-duplicatetab', (event, arg) => {
  var url = tabGroup.getActiveTab().webview.src;
  tabGroup.addTab();
  tabGroup.getActiveTab().webview.loadURL(url);
});
ipcRenderer.on('action-tab-closetab', (event, arg) => {
  tabGroup.getActiveTab().close(false);
});
ipcRenderer.on('action-tab-goback', (event, arg) => {
  tabGroup.getActiveTab().webview.goBack();
});
ipcRenderer.on('action-tab-closeright', (event, arg) => {
  var curPos = tabGroup.getActiveTab().getPosition(false);
  tabGroup.eachTab((currentTab, index, tabs) => {
    if(currentTab.getPosition(false) > curPos) {
      currentTab.close(false);
    }
  });
});
ipcRenderer.on('action-tab-closeothers', (event, arg) => {
  var curPos = tabGroup.getActiveTab().getPosition(false);
  tabGroup.eachTab((currentTab, index, tabs) => {
    if(currentTab.getPosition(false) != curPos) {
      currentTab.close(false);
    }
  });
});

ipcRenderer.on('action-esc', (event, arg) => {
  esc();
});
ipcRenderer.on('action-page-focussearch', (event, arg) => {
  focusSearch();
});

ipcRenderer.on('action-open-bookmarks', (event, arg) => {
  goToBookmarksTab();
});
ipcRenderer.on('action-bookmark-this-page', (event, arg) => {
  createBookmark(tabGroup.getActiveTab().webview.getURL(), tabGroup.getActiveTab().webview.getTitle(), null);
});

ipcRenderer.on('action-open-downloads', (event, arg) => {
  goToDownloadsTab();
});

ipcRenderer.on('action-open-settings', (event, arg) => {
  goToSettingsTab(arg);
});

ipcRenderer.on('action-zoom-zoomout', (event, arg) => {
  zoomOut();
});

ipcRenderer.on('action-zoom-zoomin', (event, arg) => {
  zoomIn(); 
});

ipcRenderer.on('action-zoom-actualsize', (event, arg) => {
  var zoomFactor = tabGroup.getActiveTab().webview.getZoomFactor();
  if (zoomFactor != 1) {
    tabGroup.getActiveTab().webview.setZoomFactor(1);
      notif("Zoom factor changed to the actual size (100%)", "info");
      tabGroup.getActiveTab().webview.focus();
  }
});

ipcRenderer.on('action-edit-cut', (event, arg) => {
  tabGroup.getActiveTab().webview.cut();
  tabGroup.getActiveTab().webview.focus();
});

ipcRenderer.on('action-edit-copy', (event, arg) => {
  tabGroup.getActiveTab().webview.copy();
  tabGroup.getActiveTab().webview.focus();
});

ipcRenderer.on('action-edit-paste', (event, arg) => {
  tabGroup.getActiveTab().webview.paste();
  tabGroup.getActiveTab().webview.focus();
});

ipcRenderer.on('action-edit-undo', (event, arg) => {
  tabGroup.getActiveTab().webview.undo();
  tabGroup.getActiveTab().webview.focus();
});

ipcRenderer.on('action-edit-redo', (event, arg) => {
  tabGroup.getActiveTab().webview.redo();
  tabGroup.getActiveTab().webview.focus();
});

ipcRenderer.on('action-edit-selectall', (event, arg) => {
  tabGroup.getActiveTab().webview.selectAll();
  tabGroup.getActiveTab().webview.focus();
});

ipcRenderer.on('action-edit-delete', (event, arg) => {
  tabGroup.getActiveTab().webview.delete();
  tabGroup.getActiveTab().webview.focus();
});

ipcRenderer.on('action-page-devtools', (event, arg) => {
  if (tabGroup.getActiveTab().webview.isDevToolsOpened()) {
    tabGroup.getActiveTab().webview.closeDevTools();
  } else {
    tabGroup.getActiveTab().webview.openDevTools();
  }
});

ipcRenderer.on('action-page-viewsource', (event, arg) => {
  var sourceUrl = 'view-source:' + tabGroup.getActiveTab().webview.getURL();
  tabGroup.addTab({
    title: 'View page source',
    src: sourceUrl,
    active: true,
    webviewAttributes: {
      preload: "../js/webview.js"
    }
  });
});

ipcRenderer.on('action-page-inspect', (event, arg) => {
  arg.y += document.getElementById('etabs-views').getBoundingClientRect().top;
  tabGroup.getActiveTab().webview.inspectElement(arg.x, arg.y);
});

ipcRenderer.on('action-page-findinpage', (event, arg) => {
  showFindPanel();
});

ipcRenderer.on('action-page-certificate', (event, arg) => {
  ipcRenderer.send('request-show-certificate-info', tabGroup.getActiveTab().webview.src);
});

// ipcRenderer.on('action-page-saveas', (event, arg) => {
//   ipcRenderer.send('request-save-as-page', tabGroup.getActiveTab().webview.src);
// });

ipcRenderer.on('action-app-about', (event, arg) => {
  goToAboutTab();
});

ipcRenderer.on('action-tabcontext-closeright', (event, arg) => {
  var curPos = tabGroup.getTab(arg).getPosition(false);
  tabGroup.eachTab((currentTab, index, tabs) => {
    if(currentTab.getPosition(false) > curPos) {
      currentTab.close(false);
    }
  });
});

ipcRenderer.on('action-tabcontext-closeothers', (event, arg) => {
  var tab = tabGroup.getTab(arg);
  tabGroup.eachTab((currentTab, index, tabs) => {
    if(currentTab != tab) {
      currentTab.close(false);
    }
  });
});

ipcRenderer.on('action-tabcontext-back', (event, arg) => {
  tabGroup.getTab(arg).webview.goBack();
});

ipcRenderer.on('action-tabcontext-copyurl', (event, arg) => {
  copyText(tabGroup.getTab(arg).webview.getURL());
});

ipcRenderer.on('action-tabcontext-forward', (event, arg) => {
  tabGroup.getTab(arg).webview.goForward();
});

ipcRenderer.on('action-tabcontext-picturein', (event, arg) => {
  var url = tabGroup.getTab(arg).webview.getURL();
  pictureIn(url);
});

ipcRenderer.on('action-tabcontext-gohome', (event, arg) => {
  try {
    var jsonstr = fs.readFileSync(ppath + "\\json\\home.json");
    Data = JSON.parse(jsonstr);
    tabGroup.getTab(arg).webview.loadURL(Data.url);
  } catch (e) {

  }
});

ipcRenderer.on('action-tabcontext-reload', (event, arg) => {
  tabGroup.getTab(arg).webview.reload();
});

ipcRenderer.on('action-tabcontext-duplicatetab', (event, arg) => {
  var url = tabGroup.getTab(arg).webview.src;
  tabGroup.addTab();
  tabGroup.getActiveTab().webview.loadURL(url);
});

ipcRenderer.on('action-tabcontext-closetab', (event, arg) => {
  tabGroup.getTab(arg).close();
});

ipcRenderer.on('action-notif', (event, arg) => {
  notif(arg.text, arg.type);
});

ipcRenderer.on('action-quest', (event, arg) => {
  quest(arg.text, arg.ops);
});

ipcRenderer.on('action-loader', (event, arg) => {
  loader(arg.text, arg.id);
});

ipcRenderer.on('action-update-loader', (event, arg) => {
  updateLoader(arg.percent, arg.id);
});

ipcRenderer.on('action-change-theme', (event, arg) => {
  applyTheme(arg);
});

ipcRenderer.on('action-toggle-sidebar', (event, arg) => {
  toggleSidebar();
});

ipcRenderer.on('action-change-border-radius', (event, arg) => {
  applyBorderRadius(arg);
});

ipcRenderer.on('action-toggle-fullscreen', (event, arg) => {
  if (arg) {
    document.body.classList.add('fullscreen');
  } else {
    document.body.classList.remove('fullscreen');
  }
  tabGroup.getActiveTab().webview.focus();
});

ipcRenderer.on('action-activate-tab', (event, arg) => {
  tabGroup.getTabByPosition(arg + 1).activate();
});

ipcRenderer.on('action-blur-window', (event, arg) => {
  document.getElementById('etabs-tabgroup').classList.add('blur');
});

ipcRenderer.on('action-focus-window', (event, arg) => {
  document.getElementById('etabs-tabgroup').classList.remove('blur');
});

ipcRenderer.on('action-open-url', (event, arg) => {
  tabGroup.getActiveTab().webview.loadURL(arg);
  if(!document.body.classList.contains('pinned-sidebar')) {
    hideSidebar();
  }
});

ipcRenderer.on('action-open-url-in-new-tab', (event, arg) => {
  tabGroup.addTab({
    title: 'New Tab',
    src: arg,
    active: true,
    webviewAttributes: {
      preload: "../js/webview.js"
    }
  });
  if(!document.body.classList.contains('pinned-sidebar')) {
    hideSidebar();
  }
});

ipcRenderer.on('action-set-search-engine', (event, arg) => {
  var engines = document.getElementsByClassName('search-engine');
  for(var i = 0; i < engines.length; i++) {
    if(engines[i].name == arg) {
      engines[i].classList.add('active');
    } else {
      engines[i].classList.remove('active');
    }
  }
});

ipcRenderer.on('action-set-start-page', (event, arg) => {
  tabGroup.options.newTab.src = arg;
});

ipcRenderer.on('action-add-history-item', (event, arg) => {
  document.getElementById('sidebar-webview').send('action-add-history-item', arg);
});

ipcRenderer.on('action-create-download', (event, arg) => {
  document.getElementById('sidebar-webview').send('action-create-download', arg);
  notif('Download started: ' + arg.name, 'info');
  loader('Downloading file: ' + arg.name, "download-" + arg.index);
});

ipcRenderer.on('action-create-stopped-download', (event, arg) => {
  document.getElementById('sidebar-webview').send('action-create-stopped-download', arg);
});

ipcRenderer.on('action-set-download-status-pause', (event, arg) => {
  document.getElementById('sidebar-webview').send('action-set-download-status-pause', arg);
});

ipcRenderer.on('action-set-download-status-done', (event, arg) => {
  document.getElementById('sidebar-webview').send('action-set-download-status-done', arg);
  notif('Download complete: ' + arg.name, 'success');
  removeNotifById('download-' + arg.index);
});

ipcRenderer.on('action-set-download-status-failed', (event, arg) => {
  document.getElementById('sidebar-webview').send('action-set-download-status-failed', arg);
  notif('Download ' + arg.state + ": " + arg.name, 'error');
  removeNotifById('download-' + arg.index);
});

ipcRenderer.on('action-set-download-status-interrupted', (event, arg) => {
  document.getElementById('sidebar-webview').send('action-set-download-status-interrupted', arg);
  notif('Download interrupted: ' + arg.name, 'warning');
  removeNotifById('download-' + arg.index);
});

ipcRenderer.on('action-set-download-process', (event, arg) => {
  document.getElementById('sidebar-webview').send('action-set-download-process', arg);
  updateLoader(Math.round(arg.bytes / arg.total * 100), "download-" + arg.index)
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
  loadHome();
  loadSidebar();
  loadBookmarksBar();
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