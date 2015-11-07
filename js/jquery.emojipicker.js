;(function($) {

  var pluginName = "emojiPicker",
      defaults = {
        width: '200',
        height: '350',
        position: 'right',
        fadeTime: 100,
        iconColor: 'black',
        iconBackgroundColor: '#eee',
        container: 'body',
        button: true,
        contenteditable: false,
        iconSizeSm: false,
        wrapperClass: 'emojiPickerIconWrap',
        unicode: false
      };

  var MIN_WIDTH = 250,
      MAX_WIDTH = 600,
      MIN_HEIGHT = 100,
      MAX_HEIGHT = 350,
      MAX_ICON_HEIGHT = 50;
      MIN_ICON_HEIGHT = 15;

  function Plugin( element, options ) {

    this.element = element;
    this.$el = $(element);

    this.settings = $.extend( {}, defaults, options );

    this.$container = $(this.settings.container);

    // (type) Safety first
    this.settings.width = parseInt(this.settings.width);
    this.settings.height = parseInt(this.settings.height);
    this.settings.contenteditable = this.settings.contenteditable.constructor === Boolean ? this.settings.contenteditable : false;
    this.settings.unicode = this.settings.unicode.constructor === Boolean ? this.settings.unicode : false;
    this.settings.iconSizeSm = this.settings.iconSizeSm.constructor === Boolean ? this.settings.iconSizeSm : false;

    // Check for valid width/height
    if(this.settings.width >= MAX_WIDTH) {
      this.settings.width = MAX_WIDTH;
    } else if (this.settings.width < MIN_WIDTH) {
      this.settings.width = MIN_WIDTH;
    }
    if (this.settings.height >= MAX_HEIGHT) {
      this.settings.height = MAX_HEIGHT;
    } else if (this.settings.height < MIN_HEIGHT) {
      this.settings.height = MIN_HEIGHT;
    }

    var possiblePositions = [ 'left',
                              'right'
                              /*,'top',
                              'bottom'*/];
    if($.inArray(this.settings.position,possiblePositions) == -1) {
      this.settings.position = defaults.position; //current default
    }

    // Do not enable if on mobile device (emojis already present)
    if(!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
      this.init();
    }

  }

  $.extend(Plugin.prototype, {

    init: function() {
      this.active = false;
      this.addPickerIcon();
      this.createPicker();
      this.listen();
      this.ce();
    },

    ce: function () {
      if (this.settings.contenteditable) {
        var editor = this.$el;
        var that = this;

        if (!this.settings.unicode) {
          var t = editor.text();
          if(t.length > 0){
            for (var i = 0; i < $.fn.emojiPicker.emojis.length; ++i) {
              var emojiUnicode = toUnicode($.fn.emojiPicker.emojis[i].unicode),
               emojiHtml = "<img src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAQAIBRAA7' class='emojiCe emoji-" + $.fn.emojiPicker.emojis[i].shortcode + "' data-unicode='" + emojiUnicode + "'/>";
              t = t.replace(new RegExp(emojiUnicode, 'g'), emojiHtml);
            }
          }
          editor.html(t);
        }
        editor.on('input click', function (e) {
          var element = this;
          var doc = element.ownerDocument || element.document;
          var win = doc.defaultView || doc.parentWindow;
          var sel;
          sel = win.getSelection();
          if (sel.rangeCount > 0) {
            var range = sel.getRangeAt(0);
            sel.removeAllRanges();
            sel.addRange(range);
            that.editorRange = range;
          }
          that.getCeText();
        });

        editor.on('paste', function (e) {
          e.preventDefault();
          var text = (e.originalEvent || e).clipboardData.getData('text/plain') || prompt('Paste something..');
          window.document.execCommand('insertText', false, text);
        });
      }
    },

    getCeText: function() {
      if (this.settings.unicode) return;

      var editor = this.$el.clone();
      $('img', editor).each(function(){
        $(this).replaceWith($(this).data('unicode'));
      });
      this.$el.data('text', editor.text());
    },

    addPickerIcon: function() {
      // The wrapper is not needed if they have chosen to not use a button
      if (this.settings.button) {
        var elementHeight = this.$el.outerHeight();
        var iconHeight = MIN_ICON_HEIGHT;

        if (!this.settings.iconSizeSm) {
          iconHeight = elementHeight > MAX_ICON_HEIGHT ?
            MAX_ICON_HEIGHT :
            elementHeight;
        }

        // This can cause issues if the element is not visible when it is initiated
        var objectWidth = this.$el.width();

        this.$el.width(objectWidth);

        this.$wrapper = this.$el
          .wrap("<div class='" + this.settings.wrapperClass + "'></div>")
          .parent();

        this.$icon = $('<div class="emojiPickerIcon"></div>')
          .height(iconHeight)
          .width(iconHeight)
          .addClass(this.settings.iconColor)
          .css('backgroundColor', this.settings.iconBackgroundColor)
          .attr('title', 'Emoji Picker');
          this.$wrapper.append( this.$icon );
      }

    },

    createPicker: function() {

      // Show template
      this.$picker = $( getPickerHTML(this) )
        .appendTo( this.$container )
        .width(this.settings.width)
        .height(this.settings.height)
        .css('z-index',10000);

      // Picker height
      this.$picker.find('section')
        .height(parseInt(this.settings.height) - 40); // 40 is height of the tabs

      // Tab size based on width
      if (this.settings.unicode || (this.settings.width < 250)) {
        this.$picker.find('.emoji').css({'width':'1.3em', 'height':'1.3em'});
      }

    },

    listen: function() {
      // If the button is being used, wrapper has not been set,
      //    and will not need a listener
      if (this.settings.button){
        // Clicking on the picker icon
        this.$wrapper.find('.emojiPickerIcon')
          .click( $.proxy(this.iconClicked, this) );
      }

      // Click event for emoji
      this.$picker.find('section div')
        .click( $.proxy(this.emojiClicked, this) );

      // Click event for active tab
      this.$picker.find('nav .tab')
        .click( $.proxy(this.emojiCategoryClicked, this) );

      this.$picker.click( $.proxy(this.pickerClicked, this) );

      $(document.body).click( $.proxy(this.clickOutside, this) );

      // Resize events forces a reposition, which may or may not actually be required
      $(window).resize( $.proxy(this.updatePosition, this) );
    },

    updatePosition: function() {

      /*  Process:
          1. Find the nearest positioned element by crawling up the ancestors, record it's offset
          2. Find the bottom left or right of the input element, record this (Account for position setting of left or right)
          3. Find the difference between the two, as this will become our new position
          4. Magic.

          N.B. The removed code had a reference to top/bottom positioning, but I don't see the use case for this..
      */

      // Step 1
      // Luckily jquery already does this...
      var positionedParent = this.$picker.offsetParent();
      var parentOffset = positionedParent.offset(); // now have a top/left object

      // Step 2
      var elOffset = this.$el.offset();
      if(this.settings.position == 'right'){
        elOffset.left += this.$el.outerWidth() - this.settings.width;
      }
      elOffset.top += this.$el.outerHeight();

      // Step 3
      var diffOffset = {
        top: (elOffset.top - parentOffset.top),
        left: (elOffset.left - parentOffset.top)
      };

      this.$picker.css({
        top: diffOffset.top,
        left: diffOffset.left
      });

      return this;
    },

    hide: function() {
      this.$picker.hide(this.settings.fadeTime, 'linear', function() {
        this.active = false;
      }.bind(this));
    },

    show: function() {
      this.$el.focus();
      this.updatePosition();
      this.$picker.show(this.settings.fadeTime, 'linear', function() {
        this.active = true;
      }.bind(this));
    },

    /************
     *  EVENTS  *
     ************/

    iconClicked : function(e) {
      if ( this.$picker.is(':hidden') ) {
        this.show();
      } else {
        this.hide();
      }
    },

    emojiClicked: function(e) {
      var emojiShortcode = $(e.target).attr('class').split('emoji-')[1];
      var emojiUnicode = toUnicode(findEmoji(emojiShortcode).unicode);
      var emojiHtml = emojiUnicode;

      if (this.settings.contenteditable) {
        if(typeof this.editorRange === 'undefined'){
          this.$el.focus().trigger('input');
        }
        if (!this.settings.unicode) {
          emojiHtml = "<img src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAQAIBRAA7' class='emojiCe " + $(e.target).attr('class') + "' data-unicode='" + emojiUnicode + "'/>";
        }
        this.editorRange = insertAtCeCaret(emojiHtml, this.editorRange);
        this.getCeText();
      }
      else {
        insertAtCaret(this.element, emojiUnicode);
      }
    },

    emojiCategoryClicked: function(e) {
      var section = '';

      // Update tab
      this.$picker.find('nav .tab').removeClass('active');
      if ($(e.target).parent().hasClass('tab')) {
        section = $(e.target).parent().attr('data-tab');
        $(e.target).parent('.tab').addClass('active');
      } else {
        section = $(e.target).attr('data-tab');
        $(e.target).addClass('active');
      }

      // Update section
      this.$picker.find('section').addClass('hidden');//.hide();
      this.$picker.find('section.' + section).removeClass('hidden');//.show();
    },

    pickerClicked: function(e) {
      e.stopPropagation();
    },

    clickOutside: function(e) {
      if ( this.active ) {
        this.hide();
      }
    }

  });

  $.fn[ pluginName ] = function ( options ) {

    // Calling a function
    if (typeof options === 'string') {
      this.each(function() {
        var plugin = $.data( this, pluginName );
        switch(options) {
          case 'toggle':
            plugin.iconClicked();
          break;
        }
      });
      return this;
    }

    this.each(function() {
      // Don't attach to the same element twice
      if ( !$.data( this, pluginName ) ) {
        $.data( this, pluginName, new Plugin( this, options ) );
      }
    });
    return this;
  };

  /* ---------------------------------------------------------------------- */

  function getPickerHTML(parent) {
    var nodes = [];
    var categories = [
      { name: 'emotion',  symbol: 'grinning',   'unicode': '1F600' },
      { name: 'animal',   symbol: 'whale',      'unicode': '1F433' },
      { name: 'food',     symbol: 'hamburger',  'unicode': '1F354' },
      { name: 'folderol', symbol: 'sunny',      'unicode': '2600'  },
      { name: 'thing',    symbol: 'kiss',       'unicode': '1F48B' },
      { name: 'travel',   symbol: 'rocket',     'unicode': '1F680' }
    ];

    var aliases = {
      'people':    'emotion',
      'symbol':    'thing',
      'undefined': 'thing'
    }
    var items = {};
    var isUnicode = parent.settings.unicode;

    // Re-Sort Emoji table
    $.each($.fn.emojiPicker.emojis, function(i, emoji) {
      var category = aliases[ emoji.category ] || emoji.category;
      items[ category ] = items[ category ] || [];
      items[ category ].push( emoji );
    });

    nodes.push('<div class="emojiPicker">');
    nodes.push('<nav>');
    for (var i in categories) {
      var emoji_content = isUnicode ? toUnicode(categories[i].unicode) : '';
      nodes.push('<div class="tab' +
      ( i == 0 ? ' active' : '' ) +
      '" data-tab="' +
      categories[i].name +
      '"><div class="emoji emoji-' +
      categories[i].symbol +
      '" title="' + categories[i].name + '">' + emoji_content + '</div></div>');
    }
    nodes.push('</nav>');

    for (var i in categories) {
      nodes.push('<section class="' +
        categories[i].name +
        ( i == 0 ? '' : ' hidden' ) +
        '">');
      for (var j in items[ categories[i].name ] ) {
        var emoji = items[ categories[i].name ][ j ],
          emoji_content = isUnicode ? toUnicode(emoji.unicode) : '',
          emoji_title = emoji.description;
        nodes.push('<div class="emoji emoji-' + emoji.shortcode + '" title="' + emoji.description.toLowerCase() + '">' + emoji_content + '</div>');
      }
      nodes.push('</section>');
    }
    nodes.push('</div>');
    return nodes.join("\n");
  }

  function findEmoji(emojiShortcode) {
    var emojis = $.fn.emojiPicker.emojis;
    for (var i = 0; i < emojis.length; i++) {
      if (emojis[i].shortcode == emojiShortcode) {
        return emojis[i];
      }
    }
  }

  function insertAtCaret(inputField, myValue) {
    if (document.selection) {
      //For browsers like Internet Explorer
      inputField.focus();
      var sel = document.selection.createRange();
      sel.text = myValue;
      inputField.focus();
    }
    else if (inputField.selectionStart || inputField.selectionStart == '0') {
      //For browsers like Firefox and Webkit based
      var startPos = inputField.selectionStart;
      var endPos = inputField.selectionEnd;
      var scrollTop = inputField.scrollTop;
      inputField.value = inputField.value.substring(0, startPos)+myValue+inputField.value.substring(endPos,inputField.value.length);
      inputField.focus();
      inputField.selectionStart = startPos + myValue.length;
      inputField.selectionEnd = startPos + myValue.length;
      inputField.scrollTop = scrollTop;
    } else {
      inputField.focus();
      inputField.value += myValue;
    }
  }

  function insertAtCeCaret(myValue, range) {
    var el = document.createElement("div");
    el.innerHTML = myValue;
    var frag = document.createDocumentFragment(), node, lastNode;
    while ((node = el.firstChild)) {
      lastNode = frag.appendChild(node);
    }
    range.insertNode(frag);
    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(false);
    }
    return range;
  }

  function toUnicode(code) {
    var codes = code.split('-').map(function(value, index) {
      return parseInt(value, 16);
    });
    return String.fromCodePoint.apply(null, codes);
  }

  if (!String.fromCodePoint) {
    // ES6 Unicode Shims 0.1 , © 2012 Steven Levithan http://slevithan.com/ , MIT License
    String.fromCodePoint = function fromCodePoint () {
        var chars = [], point, offset, units, i;
        for (i = 0; i < arguments.length; ++i) {
            point = arguments[i];
            offset = point - 0x10000;
            units = point > 0xFFFF ? [0xD800 + (offset >> 10), 0xDC00 + (offset & 0x3FF)] : [point];
            chars.push(String.fromCharCode.apply(null, units));
        }
        return chars.join("");
    }
  }

})(jQuery);
