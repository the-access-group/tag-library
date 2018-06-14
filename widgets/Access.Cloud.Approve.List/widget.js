DashboardManager.registerScripts(['https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'], function (widget, Hammer) {
    widget.showLoading();
    var _recordCount;
    var _selectedSlide = 0;
    //let _selectedHeaders: Array<string> = [];
    var _headers;
    var _gridFormat = false;
    var _filterLimit = 100;
    var _carousel = $(widget.element).find(".approve-carousel > ul");
    var _carouselFooter = $(widget.element).find(".approve-carousel-footer > ul");
    var _grid = $(widget.element).find(".approve-grid .widget-grid-body");
    var _checkAll = $(widget.element).find(".check-all");
    var _checkAllLabel = $(widget.element).find(".check-all-label");
    var _databases = [];
    var _selectedDatabase = '';
    var autoTimer;
    var _dbHomeCurrency = '';
    var _carouselTemplate = $("#approve-app-card-template");
    var _gridRowTemplate = $("#approve-app-grid-template");
    var _gridRowTemplateSpan1 = $("#approve-app-grid-template-span1");
    var _approveDialog = $("#approve-app-confirmation-modal");
    if (widget.state) {
        _gridFormat = widget.state.gridFormat;
        _filterLimit = widget.state.filterValue ? widget.state.filterValue : 100;
        _selectedDatabase = widget.state.selectedDatabase;
    }
    //pre propulate the input with the stored value. defaulted to 100
    if (_filterLimit == Math.round(_filterLimit))
        $(widget.element).find(".approve-filter-net .approve-filter-value").val(_filterLimit);
    else
        $(widget.element).find(".approve-filter-net .approve-filter-value").val(_filterLimit.toFixed(2));
    $(widget.element).find(".approve-summary a").attr("href", widget.settings.baseUrl);
    _checkAll.attr("id", "check_all_" + widget.id);
    _checkAllLabel.attr("for", "check_all_" + widget.id);
    function setAutoTimer() {
        if (autoTimer)
            clearInterval(autoTimer);
        autoTimer = setInterval(function () {
            getData();
        }, 300000);
    }
    //Initial call to get the databases. Set one if not set, and then
    widget.get(widget.settings.endpoint + 'databases').then(function (data) {
        _databases = data;
        if (data && data.length > 0) {
            if (!_selectedDatabase || _selectedDatabase.length <= 0) {
                _selectedDatabase = data[0].databaseId;
            }
            //build context menu switcher
            buildDatabaseList();
            //get the data.
            getData();
            //set auto refresh every 5 mins.
            setAutoTimer();
        }
        else {
            widget.showInfo("You have no approve databases configured", "Error");
            $(widget.element).find(".widget-context-menu .dropdown-menu li:not(:last-child)").hide();
            widget.hideLoading();
        }
    }).catch(function (err) {
        widget.logError("Error loading approve databases - " + err);
        widget.hideLoading();
    });
    //attaching events
    $(widget.element).find(".approve-footer-approve").click(function () { showDialog(); });
    $(widget.element).find(".approve-grid-footer-approve").click(function () { showDialog(); });
    $(widget.element).find(".approve-app-grid").click(function () { switchToTableMode(); });
    $(widget.element).find(".approve-app-carousel").click(function () { switchToCarouselMode(); });
    //grid check button
    _checkAll.change(function () { selectDeselectAll(); });
    //filter input button
    $(widget.element).find(".approve-filter-net .approve-filter-value").keyup(function (event) {
        if (event.keyCode == 13) {
            setNetLimit(event)
                .then(function (success) {
                $(widget.element).find(".widget-context-menu.dropdown-toggle").removeClass("open").find(".dropdown-submenu.open").removeClass("open");
            })
                .catch(function (reason) {
                event.preventDefault();
                event.stopPropagation();
            });
        }
    })
        .focusin(function (event) { $(event.target).parent(".input-group").addClass("has-focus"); })
        .focusout(function (event) { $(event.target).parent(".input-group").removeClass("has-focus"); });
    $(widget.element).find(".approve-filter-net .approve-filter-submit").click(function (event) {
        setNetLimit(event)
            .catch(function (reason) {
            event.preventDefault();
            event.stopPropagation();
        });
        ;
    });
    $(widget.element).find(".approve-filter-net button").off("click").click(function (event) {
        var val = $(widget.element).find(".approve-filter-net .approve-filter-value").val();
        var isNumeric = $.isNumeric(val.toString());
        if (isNumeric)
            $(widget.element).find(".approve-filter-net .input-group").removeClass("invalid");
        else {
            $(widget.element).find(".approve-filter-net .input-group").addClass("invalid");
            event.preventDefault();
            event.stopPropagation();
        }
    });
    $(widget.element).find(".widget-refresh").click(function () {
        setAutoTimer();
        getData();
    });
    //swiping for touch devices.
    var hammertime = new Hammer($(widget.element).find(".approve-carousel")[0]);
    hammertime.on('swipe', function (ev) {
        //swiped left, go to next
        if (ev.direction == 2)
            slideCarousel(_selectedSlide + 1);
        else
            slideCarousel(_selectedSlide - 1);
    });
    //set the initial selected filter
    setSelectedFilter();
    //build the database context menu
    function buildDatabaseList() {
        var dbList = $(widget.element).find(".approve-database");
        dbList.empty();
        $.each(_databases, function (ind, db) {
            var li = $('<li><a></a></li>');
            li.find("a")
                .attr("data-database-id", db.databaseId)
                .attr("data-database-name", db.databaseName)
                .attr("data-currency-symbol", db.homeCurrency)
                .text(db.databaseName);
            if (db.databaseId == _selectedDatabase) {
                li.addClass("selected");
                //Set the currently selected db name 
                $(widget.element).find(".approve-current-database span").text(db.databaseName);
                //set the currency text in the label on the context menu
                $(widget.element).find(".approve-filter-net span").text(db.homeCurrency);
                _dbHomeCurrency = db.homeCurrency;
            }
            dbList.append(li);
        });
        dbList.find("a").off("click").click(function (ev) { switchDatabase(ev.target); });
    }
    //context menu switch between databases.
    function switchDatabase(el) {
        //remove the selected flags and set the class on the new link
        $(widget.element).find(".approve-database li.selected").removeClass("selected");
        var link = $(el);
        link.parent().addClass("selected");
        _selectedDatabase = link.attr("data-database-id");
        _dbHomeCurrency = link.attr("data-currency-symbol");
        $(widget.element).find(".approve-filter-net span").text(link.attr("data-currency-symbol"));
        $(widget.element).find(".approve-current-database span").text(link.attr("data-database-name"));
        setState();
        getData();
        setHeaderSummary();
    }
    //retrieve data for current db.
    function getData() {
        widget.showLoading();
        widget.get(widget.settings.endpoint + "list?database=" + _selectedDatabase + "&limit=" + _filterLimit).then(function (data) {
            //not on header when no records
            _recordCount = data.approveCount ? data.approveCount : 0;
            setHeaderSummary();
            if (data.headers && data.headers.length > 0) {
                _headers = data.headers;
                //default the selectedheaderid to be the first.
            }
            else {
                _headers = null;
            }
            buildWidget();
        })
            .catch(function (err) {
            widget.logError("Error loading tasks widget - " + err);
            if (err == "Forbidden")
                widget.showError("Access is denied", "Error");
            else
                widget.showError(err, "Error");
        })
            .then(function () {
            widget.hideLoading();
        });
    }
    //wrapper method to build widget based on config
    function buildWidget() {
        widget.showLoading();
        //reset all existing elements.
        _carousel.empty();
        _carouselFooter.empty();
        if (_gridFormat) {
            $(widget.element).find(".approve-carousel").hide();
            $(widget.element).find(".approve-carousel-footer").hide();
            $(widget.element).find(".approve-grid").show();
            buildGrid();
        }
        else {
            $(widget.element).find(".approve-carousel").show();
            $(widget.element).find(".approve-carousel-footer").show();
            $(widget.element).find(".approve-grid").hide();
            buildSlides();
        }
        widget.hideLoading();
    }
    function setHeaderSummary() {
        var _filterLimitText = _dbHomeCurrency;
        if (_filterLimit == Math.round(_filterLimit))
            _filterLimitText += _filterLimit;
        else
            _filterLimitText += _filterLimit.toFixed(2);
        $(widget.element).find(".approve-count").text((_recordCount > 5
            ? "Showing 5 of " + _recordCount + " records up to "
            : "Showing " + _recordCount + " records up to ")
            + _filterLimitText + '.');
    }
    function buildSlides() {
        if (!_headers || _headers.length <= 0) {
            $(widget.element).find(".approve-carousel-footer").hide();
            return;
        }
        $(widget.element).find(".approve-carousel-footer").show();
        $.each(_headers, function (i, header) {
            var card = $(_carouselTemplate.html());
            card.attr("data-slide-index", i);
            card.attr("data-header-id", header.id);
            if (header.currentStage && header.stages) {
                var progress = Math.ceil(((header.currentStage - 1) / header.stages) * 100);
                card.find('.progress--circle').addClass("progress--" + progress);
                card.find('.progress__number').text(progress + "%");
            }
            else {
                card.find('.progress--circle').addClass("progress--0");
                card.find('.progress__number').text("?%");
            }
            card.find(".approve-supplier a").attr("href", widget.settings.baseUrl + "view/" + header.id + "/");
            card.find(".approve-supplier span").text((header.supplierCode ? header.supplierCode + ' - ' : '') + header.supplierName);
            card.find(".approve-description span").text(header.description);
            card.find(".approve-date span").text(header.dateFormatted);
            card.find(".approve-reference span").text(header.reference);
            //card.find(".approve-database span").text(header.databaseName);
            if (header.net == null)
                header.net = 0;
            if (header.vat == null)
                header.vat = 0;
            if (header.gross == null)
                header.gross = 0;
            card.find(".approve-net").text(header.currencySymbol + header.net);
            card.find(".approve-tax").text(header.currencySymbol + header.vat);
            card.find(".approve-gross").text(header.currencySymbol + header.gross);
            if (header.isDisputed)
                card.find(".approve-description").prepend('<span class="label label-warning disputed-token">Disputed</span>');
            if (header.hasBeenSplit)
                card.find(".approve-description").prepend('<span class="label label-info splitline-token">Split</span>');
            if (header.hasBeenRejected)
                card.find(".approve-description").prepend('<span class="label label-access rejected-token">Rejected</span>');
            _carousel.append(card);
        });
        setPager();
    }
    function buildGrid() {
        var _selectedHeaders = [];
        //retrieve any selected headers, so that get ids for auto refresh to re check them.
        $.each($(widget.element).find(".widget-grid-body .row-checkbox:checked"), function (ind, elem) {
            _selectedHeaders.push($(elem).data("header-id"));
        });
        _grid.empty();
        if (!_headers || _headers.length <= 0) {
            $(widget.element).find(".approve-grid").hide();
            return;
        }
        $(widget.element).find(".approve-grid").show();
        $.each(_headers, function (i, header) {
            var row = widget.span == 1 ? $(_gridRowTemplateSpan1.html()) : $(_gridRowTemplate.html());
            if (header.currentStage && header.stages) {
                var progress = Math.ceil(((header.currentStage - 1) / header.stages) * 100);
                row.find('.progress--circle').addClass("progress--" + progress);
                row.find('.progress__number').text(progress + "%");
            }
            else {
                row.find('.progress--circle').addClass("progress--0");
                row.find('.progress__number').text("?%");
            }
            var check = $(row).find(".checkbox-column input");
            var label = $(row).find(".checkbox-column label");
            check.attr("id", "app_header_" + header.id).attr("data-header-id", header.id);
            label.attr("for", "app_header_" + header.id);
            if (_selectedHeaders.length > 0 && _selectedHeaders.indexOf(header.id) >= 0)
                check.prop("checked", true);
            row.find(".grid-supplier").attr("href", widget.settings.baseUrl + "view/" + header.id + "/");
            row.find(".grid-supplier").text((header.supplierCode ? header.supplierCode + ' - ' : '') + header.supplierName);
            row.find(".grid-database").text(header.databaseName);
            row.find(".grid-description").text(header.description);
            row.find(".grid-date span").text(header.dateFormatted);
            row.find(".grid-reference").text(header.reference);
            //card.find(".approve-database span").text(header.databaseName);
            if (header.isDisputed)
                row.find(".grid-description").prepend('<span class="label label-warning disputed-token">Disputed</span>');
            if (header.hasBeenSplit)
                row.find(".grid-description").prepend('<span class="label label-info splitline-token">Split</span>');
            if (header.hasBeenRejected)
                row.find(".grid-description").prepend('<span class="label label-access rejected-token">Rejected</span>');
            row.find(".grid-net").text(header.currencySymbol + header.net);
            _grid.append(row);
        });
        //attach events
        $(widget.element).find(".widget-grid-body li").click(function (e) { selectRow(e); });
    }
    //build the pager dots.
    function setPager() {
        var visible = _recordCount > 5 ? 5 : _recordCount;
        if (visible > 0)
            $(widget.element).find(".approve-carousel-footer").show();
        for (var i = 0; i < visible; i++) {
            var footTab = $('<li data-index="' + i + '"><span></span></li>');
            if (i === 0)
                footTab.addClass("active");
            footTab.click(function (event) {
                setCarouselPageIndex(event.currentTarget);
            });
            _carouselFooter.append(footTab);
        }
    }
    function setCarouselPageIndex(pageElement) {
        var index = $(pageElement).data("index");
        slideCarousel(index);
    }
    function slideCarousel(index) {
        if (index < 0) {
            _selectedSlide = 0;
            return;
        }
        else if (index >= _headers.length) {
            _selectedSlide = _headers.length - 1;
            return;
        }
        var footer = $(widget.element).find(".approve-carousel-footer ul");
        footer.find("li").removeClass("active");
        footer.find('li[data-index=' + index + ']').addClass("active");
        //shift the carousel to the left necessary amount.
        var carousel = $(widget.element).find(".approve-carousel ul");
        carousel.css("left", index <= 0 ? "0px" : (-index * 100) + "%");
        _selectedSlide = index;
    }
    function showDialog() {
        _approveDialog.find(".app-dialog-working").hide();
        _approveDialog.find(".app-dialog-complete").hide();
        _approveDialog.find(".app-dialog-approve").show();
        _approveDialog.find(".app-dialog-button-approve").show();
        _approveDialog.find(".app-dialog-approve-cancel").show();
        _approveDialog.find(".app-dialog-approve-cancel").text("Cancel");
        var keys = getSelectedHeaders();
        if (keys.length <= 0) {
            _approveDialog.find(".app-dialog-approve p").text("You have not selected any records to approve");
            _approveDialog.find(".app-dialog-button-approve").hide();
        }
        else {
            _approveDialog.find(".app-dialog-approve p").text("Are you sure you wish to approve the selected transaction" + (keys.length > 1 ? 's' : '') + "?");
            _approveDialog.find(".app-dialog-button-approve").show();
        }
        //attach button clicks to modal
        _approveDialog.find(".app-dialog-button-approve").off('click').click(function () { approveRecords(); });
        _approveDialog.modal('show');
    }
    function getSelectedHeaders() {
        var keys = [];
        if (_gridFormat) {
            var selectedRows = $(widget.element).find(".widget-grid-body .row-checkbox");
            $.each(selectedRows, function (i, el) {
                if ($(el).prop("checked")) {
                    var checkedId_1 = $(el).attr("data-header-id");
                    var find = $.grep(_headers, function (el, ind) {
                        return el.id == checkedId_1;
                    });
                    if (find.length > 0) {
                        keys.push(find[0].id);
                    }
                }
            });
        }
        else {
            var selectedSlide = $(widget.element).find('.approve-card[data-slide-index="' + _selectedSlide + '"]');
            if (selectedSlide.length > 0) {
                var checkedId_2 = $(selectedSlide).attr("data-header-id");
                var find = $.grep(_headers, function (el, ind) {
                    return el.id == checkedId_2;
                });
                if (find.length > 0) {
                    keys.push(find[0].id);
                }
            }
        }
        return keys;
    }
    function approveRecords() {
        //let selectedHeaders :Array<ApproveHeader> = [];
        var data = [];
        var selectedIds = getSelectedHeaders();
        $.each(selectedIds, function (i, checkedId) {
            var find = $.grep(_headers, function (el, ind) {
                return el.id == checkedId;
            });
            if (find.length > 0) {
                data.push({
                    headerId: find[0].id,
                    lastUpdated: find[0].lastUpdated
                });
            }
        });
        if (data.length <= 0)
            return;
        var url = widget.settings.endpoint + "approve"; //?headerId=" + header[0].id + "&lastUpdated=" + header[0].lastUpdated;
        _approveDialog.find(".app-dialog-approve").hide();
        _approveDialog.find(".app-dialog-working").show();
        _approveDialog.find(".app-dialog-button-approve").hide();
        //hide the cancel button
        _approveDialog.find(".app-dialog-approve-cancel").hide();
        widget.put(url, { '': data }, null)
            .then(function (data) {
            _approveDialog.find(".app-dialog-working").hide();
            var complete = _approveDialog.find(".app-dialog-complete");
            var result = '';
            if (data.success) {
                result = data.success + ' record' + (data.success > 1 ? 's' : '') + ' successfully approved. <br/>';
            }
            if (data.failure) {
                result += data.failure + ' record' + (data.failure > 1 ? 's' : '') + ' failed to approve.';
            }
            complete.find("p").html(result);
            if (data.messages) {
                var messageList_1 = $('<ul></ul>');
                $.each(data.messages.split("\r\n"), function (ind, str) {
                    if (str.length > 0) {
                        var li = $('<li></li>');
                        li.text(str);
                        messageList_1.append(li);
                    }
                });
                complete.find('p').append(messageList_1);
                widget.logError(data.messages);
            }
            complete.show();
            getData();
        })
            .catch(function (reason) {
            _approveDialog.find(".app-dialog-working").hide();
            var complete = _approveDialog.find(".app-dialog-complete");
            complete.show();
            complete.find("p").text(reason);
            widget.logError(reason);
        })
            .finally(function () {
            _approveDialog.find(".app-dialog-approve-cancel").show();
            _approveDialog.find(".app-dialog-approve-cancel").text("Close");
            $(widget.element).find(".checkbox-column .row-checkbox").prop('checked', false);
            setSelectedCount();
            _checkAll.prop('checked', false);
        });
    }
    function switchToTableMode() {
        _gridFormat = true;
        buildWidget();
        setState();
    }
    function switchToCarouselMode() {
        _gridFormat = false;
        buildWidget();
        setState();
    }
    function setNetLimit(event) {
        return new Promise(function (resolve, reject) {
            var input = $(widget.element).find(".approve-filter-value");
            var val = input.val();
            var isNumeric = $.isNumeric(val.toString());
            if (isNumeric) {
                var limit = parseFloat(val.toString());
                _filterLimit = limit;
                $(widget.element).find(".approve-filter-net .input-group").removeClass("invalid");
                setSelectedFilter();
                getData();
                setState();
                resolve(true);
            }
            else {
                $(widget.element).find(".approve-filter-net .input-group").addClass("invalid");
                reject(false);
            }
        });
    }
    function setState() {
        widget.state = {
            gridFormat: _gridFormat,
            filterValue: _filterLimit,
            selectedDatabase: _selectedDatabase
        };
    }
    ;
    function selectDeselectAll() {
        var checked = _checkAll.prop('checked');
        $(widget.element).find(".checkbox-column .row-checkbox").prop("checked", checked ? 'checked' : '');
        setSelectedCount();
    }
    function selectRow(event) {
        var elem = $(event.currentTarget);
        //if picked up the link click ignore
        if ($(event.target).hasClass("grid-supplier"))
            return;
        var rowCheck = elem.find(".row-checkbox");
        rowCheck.prop('checked', !rowCheck.prop('checked'));
        setSelectedCount();
    }
    function setSelectedCount() {
        var selectedCount = $(widget.element).find(".row-checkbox:checked");
        $(widget.element).find(".selected-count").text(selectedCount.length > 0
            ? "(" + selectedCount.length + " selected)"
            : "");
        if (_headers && selectedCount.length == _headers.length) {
            _checkAll.prop("checked", true);
        }
        else if (selectedCount.length <= 0) {
            _checkAll.prop("checked", false);
        }
    }
    function setSelectedFilter() {
        $(widget.element).find('.approve-filter-net li.selected').removeClass("selected");
        $(widget.element).find('.approve-filter-net a[data-value="' + _filterLimit + '"]').parent().addClass("selected");
    }
    widget.onRemove = function () {
        clearTimeout(autoTimer);
    };
    widget.onSpanChanged = function () {
        buildWidget();
    };
});
