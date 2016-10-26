(function () {
  'use strict';

  HandsomeTrello = {
    plugins: HandsomeTrello.plugins,
    callbacks: HandsomeTrello.callbacks,
    settings: HandsomeTrello.settings,
    options: {},
    api: HandsomeTrello.api,

    data: {
      init: false,
      loading: false,
      loaded: false,
      me: {},
      boardId: undefined,
      boardData: false,
      boardAccess: false,
      cards: {},
      columns: {},

      regexp: {
        boardPathname: /^\/b\/([a-zA-Z0-9]+)/,
        cardId: /#([0-9]+)/,
        cardIdFromLink: /\/c\/[a-zA-Z0-9]+\/([0-9]+)/,
        cardShortLink: /\/c\/([a-zA-Z0-9]+)/,
        cardPathname: /^\/c\/([a-zA-Z0-9]+)/
      },

      reloadTimeout: 0,
      reloadInterval: 0,
      updateBoardInterval: 0,
      updateTaskDescInterval: 0,
      updateLinkCheckInterval: 0,
      popOverResizeTimeout: 0,
      lockCheckUpdateDOM: {},

      popOverTitle: undefined,

      notificationTimeout: 0,

      intervalTime: 50
    },

    sortByProperty: function (array, property) {
      function getPropertyByPath(object) {
        return property.split('.').reduce(function (val, key) {
          return val[key];
        }, object);
      }

      array.sort(function (a, b) {
        return getPropertyByPath(a) - getPropertyByPath(b);
      });
    },

    isJSONString: function (string) {
      try {
        JSON.parse(string);
      } catch (e) {
        return false;
      }
      return true;
    },

    checkLockedDOM: function () {
      var self = this;

      return Object.keys(self.data.lockCheckUpdateDOM).length;
    },

    lockDOM: function (target, status) {
      var self = this;

      var hasLockCheckUpdateDOM = typeof self.data.lockCheckUpdateDOM[target] !== 'undefined';

      if (status) {
        if (hasLockCheckUpdateDOM) {
          self.data.lockCheckUpdateDOM[target]++;
        } else {
          self.data.lockCheckUpdateDOM[target] = 1;
        }
      } else {
        if (hasLockCheckUpdateDOM) {
          self.data.lockCheckUpdateDOM[target]--;

          if (!self.data.lockCheckUpdateDOM[target]) {
            delete self.data.lockCheckUpdateDOM[target];
          }
        }
      }
    },

    getCookie: function (name) {
      var matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));

      return matches ? decodeURIComponent(matches[1]) : undefined;
    },

    loadSettings: function () {
      var self = this;

      loadSettings(self.settings.options, function (options) {
        self.options = options;
      });
    },

    saveSettings: function () {
      var self = this;

      saveSettings(self.options);
    },

    triggerResize: function () {
      window.dispatchEvent(new Event('resize'));
    },

    findParentByClass: function (element, className) {
      if (typeof element !== 'undefined') {
        while (typeof element.parentElement !== 'undefined' && (element = element.parentElement) !== null) {
          if (element.classList.contains(className)) {
            return element;
          }
        }
      }

      return false;
    },

    getOffset: function (element) {
      function getOffsetSum(element) {
        var top = 0,
            left = 0;

        while (element) {
          top = top + parseInt(element.offsetTop);
          left = left + parseInt(element.offsetLeft);

          element = element.offsetParent;
        }

        return {
          top: top,
          left: left
        };
      }

      function getOffsetRect(element) {
        var box = element.getBoundingClientRect(),
            body = document.body,
            docElem = document.documentElement,
            scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop,
            scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft,
            clientTop = docElem.clientTop || body.clientTop || 0,
            clientLeft = docElem.clientLeft || body.clientLeft || 0,
            top = box.top + scrollTop - clientTop,
            left = box.left + scrollLeft - clientLeft;

        return {
          top: Math.round(top),
          left: Math.round(left)
        };
      }

      if (element.getBoundingClientRect) {
        return getOffsetRect(element);
      } else {
        return getOffsetSum(element);
      }
    },

    generateElementFromHtml: function (html) {
      var _div = document.createElement('div');
      _div.innerHTML = html;

      return _div.children.length > 1 ? _div : _div.children[0];
    },

    appendElementAfterAnother: function (_element, _beforeElement) {
      var self = this;

      if (typeof _element === 'string') {
        _element = self.generateElementFromHtml(_element);
      }

      if (_beforeElement.nextSibling) {
        _beforeElement.parentNode.insertBefore(_element, _beforeElement.nextSibling);
      } else {
        _beforeElement.parentNode.appendChild(_element);
      }
    },

    prependElement: function (_element, _parentElement) {
      var self = this;

      if (typeof _element === 'undefined') {
        return false;
      }

      if (typeof _element === 'string') {
        if (!_element.trim().length) {
          return false;
        }

        _element = self.generateElementFromHtml(_element);
      }

      if (_parentElement.firstChild) {
        _parentElement.insertBefore(_element, _parentElement.firstChild);
      } else {
        _parentElement.appendChild(_element);
      }
    },

    removeElement: function (_element) {
      var self = this;

      if (typeof _element !== 'undefined' && typeof _element.parentElement !== 'undefined' && typeof _element.parentElement.removeChild !== 'undefined') {
        self.lockDOM('removeElement', true);

        _element.parentElement.removeChild(_element);

        self.lockDOM('removeElement', false);
      }
    },

    getElementByProperty: function (object, property, value) {
      for (var key in object) {
        if (object[key][property] == value) {
          return object[key];
        }
      }

      return false;
    },

    getCardByLink: function (cardLink) {
      return this.data.cards[this.getCardIdFromLink(cardLink)];
    },

    getCurrentOpenedCard: function () {
      var self = this;

      var _title = document.querySelector('.window .js-title-helper');
      if (_title && self.getCardShortLinkFromUrl()) {
        return self.getCardByLink(window.location.pathname);
      }

      return false;
    },

    // http://trello/c/uJOye8/25-test => 25
    // /c/uJOye8/25-test => 25
    getCardIdFromLink: function (link) {
      var match = link.match(this.data.regexp.cardIdFromLink);

      return match ? match[1] : false;
    },

    getCardShortLinkFromLink: function (link) {
      return link.match(this.data.regexp.cardShortLink)[1];
    },

    // http://trello/c/uJOye8 => uJOye8
    getCardShortLinkFromUrl: function () {
      var self = this;

      var match = window.location.pathname.match(this.data.regexp.cardPathname);

      if (match) {
        self.getCardData(match[1]);

        return match[1];
      } else {
        return false;
      }
    },

    // http://trello/b/uJOye8 => uJOye8
    getBoardShortLinkFromUrl: function () {
      var self = this;

      var match = window.location.pathname.match(this.data.regexp.boardPathname);

      if (match) {
        self.getBoardData(match[1]);

        return match[1];
      } else {
        return false;
      }
    },

    getMeData: function () {
      var self = this;

      if (self.data.loading) {
        return false;
      }

      self.data.loading = true;

      self.api.member.get('me', {
        boards: 'all'
      }, function (data) {
        self.data.me.data = data;

        self.data.boardAccess =
            self.data.loaded &&
            self.data.boardId &&
            typeof data.idBoards !== 'undefined' &&
            typeof data.idBoards.length !== 'undefined' &&
            data.idBoards.indexOf(self.data.boardId) > -1;

        self.data.loading = false;

        self.getBoardShortLinkFromUrl() || self.getCardShortLinkFromUrl();
      });
    },

    getCardData: function (id) {
      var self = this;

      if (self.data.boardId) {
        self.getBoardData(self.data.boardId);
      } else if (!self.data.loading) {
        self.data.loading = true;

        self.api.card.get(id, function (data) {
          self.getBoardData(data.idBoard, true);
        });
      }
    },

    getBoardData: function (id, init) {
      var self = this;

      if (!self.data.loaded && (!self.data.loading || init)) {
        self.data.loading = true;

        self.api.board.get(id, function (data) {
          self.data.boardData = data;
          self.data.boardId = data.id;

          self.updateCards();

          self.data.loaded = true;
          self.data.loading = false;

          self.data.boardAccess =
              data.id &&
              typeof self.data.me.data !== 'undefined' &&
              typeof data.members !== 'undefined' && !!self.getElementByProperty(data.members, 'id', self.data.me.data.id);
        });
      }
    },

    generateParamsStringFromObject: function (object) {
      var stringData = '';

      for (var key in object) {
        if (stringData !== '') {
          stringData += '&';
        }
        stringData += key + '=' + encodeURIComponent(object[key]);
      }

      return stringData;
    },

    checkPopOver: function (title) {
      var self = this;

      if (!self.data.popOverTitle || self.data.popOverTitle !== title) {
        return true;
      } else {
        self.popOver(false);
        return false;
      }
    },

    generatePopOver: function (_popOver, title, content) {
      var self = this;

      var _popOverHeader = document.createElement('div');
      _popOverHeader.classList.add('pop-over-header');
      _popOverHeader.classList.add('js-pop-over-header');

      var _popOverTitle = document.createElement('span');
      _popOverTitle.classList.add('pop-over-header-title');
      _popOverTitle.textContent = title;

      var _popOverCloseBtn = document.createElement('a');
      _popOverCloseBtn.setAttribute('href', '#');
      _popOverCloseBtn.classList.add('pop-over-header-close-btn');
      _popOverCloseBtn.classList.add('icon-sm');
      _popOverCloseBtn.classList.add('icon-close');

      var _popOverContent = document.createElement('div');
      _popOverContent.classList.add('pop-over-content');
      _popOverContent.classList.add('js-pop-over-content');
      _popOverContent.classList.add('u-fancy-scrollbar');
      _popOverContent.classList.add('js-tab-parent');
      _popOverContent.appendChild(self.generateElementFromHtml(content));

      _popOverHeader.appendChild(_popOverTitle);
      _popOverHeader.appendChild(_popOverCloseBtn);

      _popOver.innerHTML = '';
      _popOver.appendChild(_popOverHeader);
      _popOver.appendChild(_popOverContent);

      return {
        _popOverHeader: _popOverHeader,
        _popOverTitle: _popOverTitle,
        _popOverCloseBtn: _popOverCloseBtn,
        _popOverContent: _popOverContent
      };
    },

    updatePopOver: function () {
      var self = this;

      var _popOver = document.querySelector('.pop-over');

      function changePopOverPosition(_target) {
        var targetOffset = self.getOffset(_target),
            popOverWidth = _popOver.offsetWidth,
            popOverHeight = _popOver.offsetHeight,
            targetHeight = _target.offsetHeight,
            popOverTop = targetOffset.top + targetHeight + popOverHeight > window.innerHeight ? window.innerHeight - popOverHeight : targetOffset.top + targetHeight + self.settings.popOver.offset,
            popOverLeft = targetOffset.left + popOverWidth + self.settings.popOver.offset > window.innerWidth ? window.innerWidth - popOverWidth - self.settings.popOver.offset : targetOffset.left;

        _popOver.style.top = popOverTop + 'px';
        _popOver.style.left = popOverLeft + 'px';
      }

      if (_popOver && typeof _popOver._buttonTarget !== 'undefined') {
        changePopOverPosition(_popOver._buttonTarget);
      }
    },

    popOver: function (open, title, content, _target) {
      var self = this;

      title = open ? title : '';
      content = open ? content : '';

      var _popOver = document.querySelector('.pop-over'),
          _windowOverlay = document.querySelector('.window-overlay'),
          _window = _windowOverlay.querySelector('.window'),
          _sidebarButtons = _window.querySelectorAll('.button-link');

      function changePopOverPosition() {
        var targetOffset = self.getOffset(_target),
            popOverWidth = _popOver.offsetWidth,
            popOverHeight = _popOver.offsetHeight,
            targetHeight = _target.offsetHeight,
            popOverTop = targetOffset.top + targetHeight + popOverHeight > window.innerHeight ? window.innerHeight - popOverHeight : targetOffset.top + targetHeight + self.settings.popOver.offset,
            popOverLeft = targetOffset.left + popOverWidth + self.settings.popOver.offset > window.innerWidth ? window.innerWidth - popOverWidth - self.settings.popOver.offset : targetOffset.left;

        _popOver.style.top = popOverTop + 'px';
        _popOver.style.left = popOverLeft + 'px';
      }

      function resizePopOver() {
        clearTimeout(self.data.popOverResizeTimeout);

        self.data.popOverResizeTimeout = setTimeout(changePopOverPosition, self.settings.popOver.resizeTimeout);
      }

      function openPopOver() {
        if (!self.data.popOverTitle || self.data.popOverTitle !== title) {
          closePopOver();

          _popOver._buttonTarget = _target;

          var popOverElements = self.generatePopOver(_popOver, title, content);

          _popOver.classList.add('is-shown');

          document.body.addEventListener('keydown', keyDownPopOver);

          popOverElements._popOverCloseBtn.addEventListener('click', clickPopOver);
          document.querySelector('.js-close-window').addEventListener('click', clickPopOver);
          _window.addEventListener('click', clickPopOver);
          _windowOverlay.addEventListener('click', clickPopOver);
          window.addEventListener('resize', resizePopOver);

          self.updatePopOver();

          for (var i = 0; i < _sidebarButtons.length; i++) {
            _sidebarButtons[i].addEventListener('click', clickPopOver);
          }

          setTimeout(function () {
            self.updatePopOver();

            self.data.popOverTitle = title;
          }, 1);

          return popOverElements;
        }

        return false;
      }

      function closePopOver() {
        if (self.data.popOverTitle) {
          _popOver.classList.remove('is-shown');

          document.body.removeEventListener('keydown', keyDownPopOver);

          _window.removeEventListener('click', clickPopOver);
          _windowOverlay.removeEventListener('click', clickPopOver);
          window.removeEventListener('resize', resizePopOver);

          for (var i = 0; i < _sidebarButtons.length; i++) {
            _sidebarButtons[i].removeEventListener('click', clickPopOver);
          }

          self.data.popOverTitle = undefined;
          _popOver.innerHTML = '';

          return true;
        }

        return false;
      }

      function keyDownPopOver(e) {
        if (e.keyCode === 27 && self.data.popOverTitle) { // Esc
          e.stopPropagation();

          closePopOver();
        }
      }

      function clickPopOver(e) {
        if (self.data.popOverTitle && e.currentTarget.classList && (!e.currentTarget.classList.contains('pop-over') && !self.findParentByClass(e.currentTarget, 'pop-over')) || e.currentTarget.classList.contains('pop-over-header-close-btn') || e.currentTarget.classList.contains('js-close-window')) {
          closePopOver();
        }
      }

      if (open) {
        return openPopOver();
      } else {
        return closePopOver();
      }
    },

    openNotification: function (html, type, timeout) {
      var self = this;

      if (typeof type === 'undefined') {
        type = 'warning';
      }

      if (typeof timeout === 'undefined') {
        timeout = self.settings.notification.defaultTimeout;
      }

      var _notification = document.getElementById('notification'),
          _notificationContent = self.generateElementFromHtml('<div class="handsome-trello__inheritance-notification js-inheritance-notification app-alert-item mod-' + type + '">' + html + '</div>');

      _notification.appendChild(_notificationContent);

      _notification.style.display = 'block';

      self.data.notificationTimeout = setTimeout(function () {
        self.removeElement(_notificationContent);
      }, timeout);
    },

    goToLink: function (url) {
      var self = this;

      var _link = document.createElement('a');

      _link.setAttribute('href', url);
      _link.classList.add('hide');

      document.body.appendChild(_link);

      _link.click();

      self.removeElement(_link);
    },

    createCardData: function (cardData, _card, _cardLink, _column) {
      var self = this;

      return {
        id: cardData.id,
        idShort: cardData.idShort,
        title: cardData.name,
        pos: cardData.pos,
        status: cardData.closed ? 'closed' : 'opened',
        shortLink: cardData.shortLink,
        shortUrl: cardData.shortUrl,
        url: cardData.url,
        due: cardData.due,
        column: self.getElementByProperty(self.data.boardData.lists, 'id', cardData.idList),
        _element: _card,
        _link: _cardLink,
        _column: _column,
        data: cardData
      };
    },

    parseCard: function (_card) {
      var self = this;

      var _cardLink = _card.querySelector('.js-card-name');

      if (!_cardLink || !_cardLink.href) {
        return false;
      }

      var cardLink = _cardLink.href,
          cardRealId = self.getCardShortLinkFromUrl(cardLink),
          cardId = self.getCardIdFromLink(cardLink),
          cardData = self.getElementByProperty(self.data.boardData.cards, 'idShort', cardId);

      if (!cardData && cardRealId) {
        cardData = {
          id: cardRealId,
          idShort: cardId,
          name: _cardLink.innerHTML.replace(/<span(.*)<\/span>/, '').trim(),
          url: cardLink,
          checklists: []
        };

        self.api.card.get(cardData.id, function (data) {
          if (data && !self.getElementByProperty(self.data.boardData.cards, 'idShort', cardId)) {
            self.data.boardData.cards.push(data);

            self.parseCard(_card);
          }
        });
      }

      var _column = self.findParentByClass(_card, 'js-list');

      self.data.cards[cardData.idShort] = self.createCardData(cardData, _card, _cardLink, _column);

      var column = self.data.cards[cardData.idShort].column;

      if (typeof self.data.columns[column.id] === 'undefined') {
        self.data.columns[column.id] = {
          title: column.name,
          pos: column.pos,
          cards: {},
          _element: _column,
          data: column
        };
      }

      self.data.columns[column.id].cards[cardData.idShort] = self.data.cards[cardData.idShort];

      return self.data.cards[cardData.idShort];
    },

    cardsUpdatedCallback: function () {
      var self = this;

      for (var pluginName in self.callbacks.cardsUpdated) {
        if (typeof self.callbacks.cardsUpdated[pluginName] === 'function') {
          self.callbacks.cardsUpdated[pluginName]();
        }
      }
    },

    waitCreatingCard: function (cardShortUrl, callback) {
      var self = this;

      var createCardInterval = setInterval(function () {
        var _card = document.querySelector('.js-card-name[href*="/c/' + self.getCardShortLinkFromLink(cardShortUrl) + '/"]');

        if (_card) {
          clearInterval(createCardInterval);

          self.lockDOM('wait-create-card', true);

          var card = self.parseCard(self.findParentByClass(_card, 'list-card'));

          self.cardsUpdatedCallback();

          self.lockDOM('wait-create-card', false);

          if (typeof callback === 'function') {
            callback(card);
          }
        }
      }, self.data.intervalTime);
    },

    updateClosedCards: function () {
      var self = this;

      for (var i = 0; i < self.data.boardData.cards.length; i++) {
        var cardData = self.data.boardData.cards[i];

        if (cardData.closed === true) {
          self.data.cards[cardData.idShort] = self.createCardData(cardData);
        }
      }
    },

    updateCards: function () {
      var self = this;

      clearInterval(self.data.updateBoardInterval);

      self.data.updateBoardInterval = setInterval(function () {
        var _cardsList = document.querySelectorAll('.list-card.js-member-droppable');

        if (_cardsList.length && self.data.boardId) {
          clearInterval(self.data.updateBoardInterval);

          self.lockDOM('update-cards', true);

          self.data.cards = {};
          self.data.columns = {};

          for (var i = 0; i < _cardsList.length; i++) {
            self.parseCard(_cardsList[i]);
          }

          self.updateClosedCards();

          self.cardsUpdatedCallback();

          self.data.init = true;

          self.lockDOM('update-cards', false);
        }
      }, self.data.intervalTime);
    },

    openCardViewed: function () {
      var self = this;

      clearInterval(self.data.updateTaskDescInterval);

      self.data.updateTaskDescInterval = setInterval(function () {
        if (self.data.boardId && self.getCardShortLinkFromUrl() && document.querySelector('.js-card-desc') && document.querySelector('.card-detail-item-block')) {
          var currentCard = self.getCurrentOpenedCard();

          if (currentCard) {
            clearInterval(self.data.updateTaskDescInterval);

            var currentCardTitle = document.querySelector('.window .js-title-helper').textContent;

            self.lockDOM('open-card-view', true);

            for (var pluginName in self.callbacks.openCardViewed) {
              if (typeof self.callbacks.openCardViewed[pluginName] === 'function') {
                self.callbacks.openCardViewed[pluginName](currentCard, currentCardTitle);
              }
            }
            self.lockDOM('open-card-view', false);
          }
        }
      }, self.data.intervalTime);
    },

    badgeChecklistUpdated: function (card) {
      var self = this;

      setTimeout(function () {
        self.lockDOM('badge-check-list-update', true);

        for (var pluginName in self.callbacks.badgeChecklistUpdated) {
          if (typeof self.callbacks.badgeChecklistUpdated[pluginName] === 'function') {
            self.callbacks.badgeChecklistUpdated[pluginName](card);
          }
        }

        self.lockDOM('badge-check-list-update', false);

        self.reloadData();
      }, self.settings.updateBadgeChecklistTimeout);
    },

    updateLink: function (_cardLink) {
      var self = this;

      if (!_cardLink) {
        return false;
      }

      clearInterval(self.data.updateLinkCheckInterval);

      self.data.updateLinkCheckInterval = setInterval(function () {
        if (_cardLink && _cardLink.href) {
          clearInterval(self.data.updateLinkCheckInterval);

          var currentCard = self.getCardByLink(_cardLink.href);

          if (currentCard) {
            currentCard.title = _cardLink.innerHTML.replace(/<span(.*)<\/span>/, '').trim();
            currentCard.status = 'opened';
            currentCard.data.name = currentCard.title;
            currentCard.data.closed = false;

            self.cardsUpdatedCallback();
          } else {
            self.reloadData();
          }
        }
      }, self.data.intervalTime);
    },

    reloadData: function (timeout) {
      var self = this;

      timeout = typeof timeout === 'number' ? timeout : typeof timeout === 'boolean' ? self.settings.reloadTimeout : 0;

      clearTimeout(self.data.reloadTimeout);
      clearInterval(self.data.reloadInterval);

      self.data.reloadTimeout = setTimeout(function () {
        self.data.reloadInterval = setInterval(function () {
          if (!self.data.loading) {
            clearInterval(self.data.reloadInterval);

            self.data.loaded = false;
            self.data.loading = false;

            self.getBoardShortLinkFromUrl() || self.getCardShortLinkFromUrl();
          }
        }, self.data.intervalTime);
      }, timeout);
    },

    init: function () {
      var self = this;

      self.api.base = self;
      self.api.board.base = self.api;
      self.api.card.base = self.api;
      self.api.checklist.base = self.api;
      self.api.member.base = self.api;

      self.loadSettings();

      for (var pluginName in self.plugins) {
        if (typeof self.settings.plugins[pluginName] !== 'undefined' && self.settings.plugins[pluginName] && typeof self.plugins[pluginName].init === 'function') {
          self.plugins[pluginName].base = self;
          self.plugins[pluginName].init();
        }
      }

      document.body.addEventListener('DOMNodeInserted', function (e) {
        if (e.target.classList && (e.target.classList.contains('board-wrapper') || (!self.data.boardId && document.querySelector('.list-card')))) {
          if (self.data.loaded && e.target.classList.contains('board-wrapper')) {
            self.data.boardId = undefined;
            self.data.loaded = false;
            self.data.loading = false;
            self.data.boardAccess = false;
          }

          self.getMeData();
        }

        if (e.target.classList && e.target.classList.contains('checklist')) {
          for (var checklistInsertedPluginName in self.callbacks.checklistInserted) {
            if (typeof self.callbacks.checklistInserted[checklistInsertedPluginName] === 'function') {
              self.callbacks.checklistInserted[checklistInsertedPluginName](e.target);
            }
          }
        }

        if (self.data.boardId && self.data.loaded && !self.checkLockedDOM()) {
          if (e.target.classList &&
              (
                  (e.target.classList.contains('js-list'))
              )
          ) {
            self.reloadData(true);
          }

          if ((e.target.nodeName === '#text' && e.target.parentNode.classList.contains('js-card-desc')) || (e.target.classList && e.target.classList.contains('card-detail-window'))) {
            self.openCardViewed();
          }

          if (e.target.classList &&
              (
                  (e.target.classList.contains('card-short-id')) ||
                  (e.target.classList.contains('list-card') && e.target.classList.contains('js-member-droppable'))
              )
          ) {
            var _card = e.target.classList.contains('card-short-id') ? self.findParentByClass(e.target, 'list-card') : e.target,
                _cardLink = _card.querySelector('.js-card-name');

            self.updateLink(_cardLink);
          }

          if (e.target.classList && e.target.classList.contains('checklist-item')) {
            for (var checkItemUpdatedPluginName in self.callbacks.checkItemUpdated) {
              if (typeof self.callbacks.checkItemUpdated[checkItemUpdatedPluginName] === 'function') {
                self.callbacks.checkItemUpdated[checkItemUpdatedPluginName](e.target);
              }
            }
          }

          if (e.target.classList && e.target.classList.contains('phenom-action')) {
            var deletedCardMatch = e.target.querySelector('.phenom-desc').textContent.match(/deleted card #([0-9]+) from/);

            if (deletedCardMatch && parseInt(deletedCardMatch[1]) > 0 && typeof self.data.cards[deletedCardMatch[1]] !== 'undefined') {
              var cardData = self.getElementByProperty(self.data.boardData.cards, 'idShort', deletedCardMatch[1]);

              if (cardData) {
                self.data.boardData.cards.splice(self.data.boardData.cards.indexOf(cardData), 1);
              }

              self.updateCards();
            }
          }

          if (e.target.classList && e.target.classList.contains('badge') && e.target.querySelector('.icon-checklist')) {
            var _parentTarget = self.findParentByClass(e.target, 'list-card');

            if (_parentTarget) {
              var _cardLinkByBadge = _parentTarget.querySelector('.js-card-name');

              if (_cardLinkByBadge && _cardLinkByBadge.href) {
                self.badgeChecklistUpdated(self.getCardByLink(_cardLinkByBadge.href));
              }
            }
          }
        }
      });

      document.body.addEventListener('DOMNodeRemoved', function (e) {
        if (self.data.boardId && self.data.loaded && !self.checkLockedDOM()) {
          if (e.target.classList &&
              !e.target.classList.contains('ui-droppable') &&
              (
                  (e.target.classList.contains('js-list')) ||
                  (e.target.classList.contains('list-card') && e.target.classList.contains('js-member-droppable'))
              )
          ) {
            self.reloadData(true);
          }

          if (e.target.classList && e.target.classList.contains('badge') && e.target.querySelector('.icon-checklist')) {
            var _parentTarget = self.findParentByClass(e.target, 'list-card');

            if (_parentTarget) {
              var _cardLink = _parentTarget.querySelector('.js-card-name');

              if (_cardLink && _cardLink.href) {
                self.badgeChecklistUpdated(self.getCardByLink(_cardLink.href));
              }
            }
          }
        }
      });

      document.body.addEventListener('DOMSubtreeModified', function (e) {
        if (self.data.boardId && self.data.loaded && !self.checkLockedDOM()) {
          if (e.target.classList && (e.target.classList.contains('js-list') || e.target.classList.contains('js-list-name'))) {
            self.reloadData(true);
          }

          if (e.target.nodeName === '#text' && e.target.textContent.match(/[0-9]+\/[0-9]+/) && e.target.textContent.match(/[0-9]+\/[0-9]+/)[0] === e.target.textContent) {
            var _parentTarget = self.findParentByClass(e.target, 'list-card');

            if (_parentTarget && _parentTarget.querySelector('.icon-checklist')) {
              var _cardLink = _parentTarget.querySelector('.js-card-name');

              if (_cardLink && _cardLink.href) {
                self.badgeChecklistUpdated(self.getCardByLink(_cardLink.href));
              }
            }
          }
        }
      });
    }
  };

  HandsomeTrello.init();

})();
