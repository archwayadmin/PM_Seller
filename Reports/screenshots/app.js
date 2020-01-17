var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00db006d-005e-0006-00cc-00a800b10013.png",
        "timestamp": 1577796394494,
        "duration": 26597
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00000089-00db-0027-0070-001c0096005f.png",
        "timestamp": 1577796421599,
        "duration": 14
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f000ab-00a8-00df-0067-00d8005600d4.png",
        "timestamp": 1577796421968,
        "duration": 247
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00af007f-00d2-006a-0052-007000e400d8.png",
        "timestamp": 1577796422578,
        "duration": 41
    },
    {
        "description": "product should be added successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577796425039,
                "type": ""
            }
        ],
        "screenShotFile": "006500a2-0018-003a-008b-007d00cd00a6.png",
        "timestamp": 1577796422992,
        "duration": 6596
    },
    {
        "description": "Verify Create A New Product - Basic Info text|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'Create A New Product - Basic Info' to contain ' Create A New Product - Basic Info'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:66:16\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "006d00ed-00a4-00b0-00f4-00be00d50004.png",
        "timestamp": 1577796429964,
        "duration": 46
    },
    {
        "description": "Verify Product ID Label|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'Product ID' to contain undefined."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:91:16\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bb004f-0010-008b-002a-00930098001b.png",
        "timestamp": 1577796430358,
        "duration": 43
    },
    {
        "description": "Verify Product Name Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00400001-004b-00ac-0032-00f400ca005a.png",
        "timestamp": 1577796430770,
        "duration": 43
    },
    {
        "description": "VerifyProduct Description Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007a007a-00a9-00cd-0055-0053001c00c9.png",
        "timestamp": 1577796431165,
        "duration": 68
    },
    {
        "description": "VerifyDefault Price Schedule ID label|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: elelement is not defined"
        ],
        "trace": [
            "ReferenceError: elelement is not defined\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:153:23)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"VerifyDefault Price Schedule ID label\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:148:1)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bb0029-008e-00d2-0085-004000ba007e.png",
        "timestamp": 1577796431603,
        "duration": 6
    },
    {
        "description": "Verify Effective Date label|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: elelement is not defined"
        ],
        "trace": [
            "ReferenceError: elelement is not defined\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:174:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Verify Effective Date label\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:171:1)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "005500b5-00cb-0080-0041-007300f200b5.png",
        "timestamp": 1577796431972,
        "duration": 4
    },
    {
        "description": "Verify Expiry Date Label|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: elelement is not defined"
        ],
        "trace": [
            "ReferenceError: elelement is not defined\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:192:17)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Verify Expiry Date Label\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:190:1)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e20093-0064-0086-0044-007200540088.png",
        "timestamp": 1577796432303,
        "duration": 4
    },
    {
        "description": "Add a Product Successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://api.ordercloud.io/v1/products - Failed to load resource: the server responded with a status of 409 (Conflict)",
                "timestamp": 1577796461521,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/vendor.js 57254:18 \"ERROR\" HttpErrorResponse",
                "timestamp": 1577796461522,
                "type": ""
            }
        ],
        "screenShotFile": "00780031-00da-0038-00b9-004100ea00ab.png",
        "timestamp": 1577796432679,
        "duration": 28839
    },
    {
        "description": "Verify Title of the ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d800d4-0054-002a-0032-009f00760015.png",
        "timestamp": 1577796461946,
        "duration": 13
    },
    {
        "description": "Veriy  links present on ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e500e0-000e-008e-0017-0030006300e3.png",
        "timestamp": 1577796462327,
        "duration": 973
    },
    {
        "description": "Verify successfull Message that Product has been added|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8588,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected false to be truthy.",
            "Expected '' to contain 'Product has been added'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:321:29)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:327:17\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a200ab-0033-00aa-005a-00a800e80046.png",
        "timestamp": 1577796463666,
        "duration": 85
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e50082-008f-0087-00c9-005f00820033.png",
        "timestamp": 1577798061133,
        "duration": 26213
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00870059-00a4-008c-0078-00bc00fc0056.png",
        "timestamp": 1577798087786,
        "duration": 19
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008000ff-00de-0098-00dc-008800d00067.png",
        "timestamp": 1577798088182,
        "duration": 238
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005a003d-0084-00fa-0089-00a8006500ea.png",
        "timestamp": 1577798088788,
        "duration": 18
    },
    {
        "description": "product should be added successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577798091202,
                "type": ""
            }
        ],
        "screenShotFile": "00e00037-0082-003b-0097-00e800dc0033.png",
        "timestamp": 1577798089149,
        "duration": 6616
    },
    {
        "description": "Verify Create A New Product - Basic Info text|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'Create A New Product - Basic Info' to contain ' Create A New Product - Basic Info'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:66:16\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c60095-002f-00ae-00af-005400af00da.png",
        "timestamp": 1577798096142,
        "duration": 53
    },
    {
        "description": "Verify Product ID Label|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'Product ID' to contain undefined."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:91:16\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "00f900bf-001c-00bb-0069-008000d500f0.png",
        "timestamp": 1577798096574,
        "duration": 43
    },
    {
        "description": "Verify Product Name Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009300ff-00c9-0007-00b7-00660072002c.png",
        "timestamp": 1577798097085,
        "duration": 49
    },
    {
        "description": "VerifyProduct Description Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001200d2-0044-00cd-00e5-007800620054.png",
        "timestamp": 1577798097516,
        "duration": 53
    },
    {
        "description": "VerifyDefault Price Schedule ID label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00de007d-0038-003a-000a-002e00d80019.png",
        "timestamp": 1577798097939,
        "duration": 137
    },
    {
        "description": "Verify Effective Date label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006e008c-0063-002d-00a1-00ac00a9007b.png",
        "timestamp": 1577798098447,
        "duration": 60
    },
    {
        "description": "Verify Expiry Date Label|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: ement is not defined"
        ],
        "trace": [
            "ReferenceError: ement is not defined\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:192:17)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Verify Expiry Date Label\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:190:1)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00890030-007c-00d2-00a5-005e003b009f.png",
        "timestamp": 1577798098875,
        "duration": 4
    },
    {
        "description": "Add a Product Successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://api.ordercloud.io/v1/products - Failed to load resource: the server responded with a status of 409 (Conflict)",
                "timestamp": 1577798128056,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/vendor.js 57254:18 \"ERROR\" HttpErrorResponse",
                "timestamp": 1577798128057,
                "type": ""
            }
        ],
        "screenShotFile": "004000b6-0099-0040-0001-00630082007f.png",
        "timestamp": 1577798099265,
        "duration": 28786
    },
    {
        "description": "Verify Title of the ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00750022-000e-0007-00b1-00e000310006.png",
        "timestamp": 1577798128440,
        "duration": 12
    },
    {
        "description": "Veriy  links present on ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003600d5-0000-000c-0096-0048007b0023.png",
        "timestamp": 1577798128807,
        "duration": 929
    },
    {
        "description": "Verify successfull Message that Product has been added|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3512,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected false to be truthy.",
            "Expected '' to contain 'Product has been added'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:321:29)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:327:17\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "004e00b6-0050-00a4-0049-004600850002.png",
        "timestamp": 1577798130104,
        "duration": 70
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0045002e-005d-0072-0092-007a00f40089.png",
        "timestamp": 1577798490696,
        "duration": 24686
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006100de-0053-0053-0084-007f009d000a.png",
        "timestamp": 1577798515892,
        "duration": 16
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003100b8-007f-00c0-0027-007c00d900ac.png",
        "timestamp": 1577798516261,
        "duration": 296
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b1002a-0069-008d-00b3-006100d10088.png",
        "timestamp": 1577798516926,
        "duration": 19
    },
    {
        "description": "product should be added successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577798519397,
                "type": ""
            }
        ],
        "screenShotFile": "001900e6-00cc-00b3-005f-0025000b0021.png",
        "timestamp": 1577798517345,
        "duration": 6578
    },
    {
        "description": "Verify Create A New Product - Basic Info text|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006d00b8-00b6-0037-00f4-007700a00034.png",
        "timestamp": 1577798524311,
        "duration": 45
    },
    {
        "description": "Verify Product ID Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002900af-00e9-006f-00f3-0053003c003f.png",
        "timestamp": 1577798524729,
        "duration": 42
    },
    {
        "description": "Verify Product Name Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00140032-00b8-00ae-00b8-005c005700c1.png",
        "timestamp": 1577798525149,
        "duration": 44
    },
    {
        "description": "VerifyProduct Description Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004e0018-002f-0070-00ac-00a900c800ed.png",
        "timestamp": 1577798525575,
        "duration": 113
    },
    {
        "description": "VerifyDefault Price Schedule ID label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009300ad-0080-00a3-0096-007c00ad0069.png",
        "timestamp": 1577798526038,
        "duration": 45
    },
    {
        "description": "Verify Effective Date label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f500b9-00c5-0040-00b1-001300ad00a6.png",
        "timestamp": 1577798526441,
        "duration": 51
    },
    {
        "description": "Verify Expiry Date Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00410049-00b5-001a-00e0-0011005e0040.png",
        "timestamp": 1577798526858,
        "duration": 42
    },
    {
        "description": "Add a Product Successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00dd0051-0089-00bb-009b-0033006c0005.png",
        "timestamp": 1577798527266,
        "duration": 28786
    },
    {
        "description": "Verify Title of the ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001d00c3-00cd-00db-0053-00fd000a00c4.png",
        "timestamp": 1577798556424,
        "duration": 13
    },
    {
        "description": "Veriy  links present on ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00350038-00ed-0056-00b5-009f00570099.png",
        "timestamp": 1577798556800,
        "duration": 933
    },
    {
        "description": "Verify successfull Message that Product has been added|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3940,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected false to be truthy.",
            "Expected '' to contain 'Product has been added'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:321:29)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:327:17\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ff007a-00b2-0083-0070-001c007000d1.png",
        "timestamp": 1577798558092,
        "duration": 89
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.manage().window().maximize()\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Window.maximize (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1686:25)\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\LoginPage\\LoginPage_spec.js:50:46\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "timestamp": 1577798646200,
        "duration": 699
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.getTitle()\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.getTitle (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1000:17)\n    at run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"verify the title of the Page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\LoginPage\\LoginPage_spec.js:69:5)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\LoginPage\\LoginPage_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798646979,
        "duration": 9
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(css selector, a))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\LoginPage\\LoginPage_spec.js:93:35)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\nFrom: Task: Run it(\"veriy all links present on page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\LoginPage\\LoginPage_spec.js:91:5)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\LoginPage\\LoginPage_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647015,
        "duration": 11
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.getCurrentUrl()\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.getCurrentUrl (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:993:17)\n    at run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Verify User has looged successfully\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\LoginPage\\LoginPage_spec.js:112:4)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\LoginPage\\LoginPage_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647050,
        "duration": 9
    },
    {
        "description": "product should be added successfully|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(xpath, //button[contains(text(),'Master Menu')]))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at addProduct.clickOnMastermenu (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\AddProduct\\AddProduct.js:47:20)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:35:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"product should be added successfully\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:33:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647084,
        "duration": 36
    },
    {
        "description": "Verify Create A New Product - Basic Info text|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(xpath, //h5[contains(text(),'Create A New Product - Basic Info')]))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:62:16)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify Create A New Product - Basic Info text\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:56:1)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647145,
        "duration": 7
    },
    {
        "description": "Verify Product ID Label|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(xpath, //label[contains(text(),'Product ID')]))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:87:17)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify Product ID Label\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:81:1)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647227,
        "duration": 7
    },
    {
        "description": "Verify Product Name Label|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(xpath, //label[contains(text(),'Product Name')]))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:111:21)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify Product Name Label\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:105:1)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647255,
        "duration": 10
    },
    {
        "description": "VerifyProduct Description Label|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(xpath, //label[contains(text(),'Product Description')]))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:134:15)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"VerifyProduct Description Label\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:126:1)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647289,
        "duration": 9
    },
    {
        "description": "VerifyDefault Price Schedule ID label|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(xpath, //label[contains(text(),'Default Price Schedule ID')]))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:156:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"VerifyDefault Price Schedule ID label\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:148:1)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647318,
        "duration": 7
    },
    {
        "description": "Verify Effective Date label|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(xpath, //label[contains(text(),'Effective Date')]))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:177:16)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify Effective Date label\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:171:1)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647346,
        "duration": 8
    },
    {
        "description": "Verify Expiry Date Label|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(xpath, //label[contains(text(),'Expiry Date')]))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:195:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify Expiry Date Label\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:190:1)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647379,
        "duration": 6
    },
    {
        "description": "Add a Product Successfully|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(xpath, //input[@id='ID']))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at addProduct.enterProductId (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\AddProduct\\AddProduct.js:71:13)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:215:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Add a Product Successfully\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:213:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647406,
        "duration": 33
    },
    {
        "description": "Verify Title of the ProductPage|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.getTitle()\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.getTitle (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1000:17)\n    at run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:59:33)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Verify Title of the ProductPage\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:271:1)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647625,
        "duration": 12
    },
    {
        "description": "Veriy  links present on ProductPage|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(css selector, a))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:295:35)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\nFrom: Task: Run it(\"Veriy  links present on ProductPage\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:293:5)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647664,
        "duration": 8
    },
    {
        "description": "Verify successfull Message that Product has been added|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7216,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(xpath, //div[@id='toast-container']))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:318:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify successfull Message that Product has been added\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:314:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577798647694,
        "duration": 10
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003b00b4-00d5-00d9-00f9-00a9001e006b.png",
        "timestamp": 1577798663919,
        "duration": 25110
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d800bb-009c-00bf-0033-009e00ab001f.png",
        "timestamp": 1577798689462,
        "duration": 17
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00150035-00a7-006e-0057-00d40003001e.png",
        "timestamp": 1577798689842,
        "duration": 268
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002d0082-0008-00d7-00ad-003500bc009d.png",
        "timestamp": 1577798690507,
        "duration": 19
    },
    {
        "description": "product should be added successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577798692933,
                "type": ""
            }
        ],
        "screenShotFile": "0070005d-0072-00aa-009c-002b004d0081.png",
        "timestamp": 1577798690888,
        "duration": 6563
    },
    {
        "description": "Verify Create A New Product - Basic Info text|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007f0039-00a3-0068-00f5-003c0078006a.png",
        "timestamp": 1577798697891,
        "duration": 58
    },
    {
        "description": "Verify Product ID Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000d0001-006e-003c-00b4-00f2006000ae.png",
        "timestamp": 1577798698323,
        "duration": 48
    },
    {
        "description": "Verify Product Name Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009100b4-006f-0057-0094-007d0036001c.png",
        "timestamp": 1577798698753,
        "duration": 49
    },
    {
        "description": "VerifyProduct Description Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00730027-0053-0044-0062-002900f5001f.png",
        "timestamp": 1577798699161,
        "duration": 54
    },
    {
        "description": "VerifyDefault Price Schedule ID label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ea0075-0056-0098-0044-007a00d60049.png",
        "timestamp": 1577798699603,
        "duration": 56
    },
    {
        "description": "Verify Effective Date label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a0080-0073-00b1-0020-006c00ee00a8.png",
        "timestamp": 1577798700060,
        "duration": 46
    },
    {
        "description": "Verify Expiry Date Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c400ed-00e1-00d9-0081-00a0006b005b.png",
        "timestamp": 1577798700478,
        "duration": 43
    },
    {
        "description": "Add a Product Successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ef00ca-00e8-000d-00bb-002400b400cb.png",
        "timestamp": 1577798700910,
        "duration": 24916
    },
    {
        "description": "Verify Title of the ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0041005e-003e-00da-00e5-005d009d0046.png",
        "timestamp": 1577798726215,
        "duration": 14
    },
    {
        "description": "Veriy  links present on ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f20053-0086-00db-00b3-005c001c006b.png",
        "timestamp": 1577798726624,
        "duration": 919
    },
    {
        "description": "Verify successfull Message that Product has been added|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1136,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //div[@id='toast-container'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //div[@id='toast-container'])\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:318:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify successfull Message that Product has been added\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:314:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:16:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bf00f4-00c2-0029-002c-00d000050067.png",
        "timestamp": 1577798727984,
        "duration": 4054
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009d00b8-0024-00de-00b0-007e007a0013.png",
        "timestamp": 1577798757817,
        "duration": 24835
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c90014-008f-00d8-00ab-00f3003d0053.png",
        "timestamp": 1577798783097,
        "duration": 16
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577798783882,
                "type": ""
            }
        ],
        "screenShotFile": "004000ae-00e7-005d-008b-00d5003d0031.png",
        "timestamp": 1577798783488,
        "duration": 406
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bb002d-0070-00e3-0075-0021001500d4.png",
        "timestamp": 1577798784299,
        "duration": 21
    },
    {
        "description": "product should be added successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00280016-0003-007c-00d4-00c2007a0002.png",
        "timestamp": 1577798784704,
        "duration": 6502
    },
    {
        "description": "Verify Create A New Product - Basic Info text|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c90075-008c-007c-006f-007500520039.png",
        "timestamp": 1577798791625,
        "duration": 50
    },
    {
        "description": "Verify Product ID Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005400f1-0053-0022-00fc-004500b7008a.png",
        "timestamp": 1577798792048,
        "duration": 44
    },
    {
        "description": "Verify Product Name Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c500a9-0042-00f8-00bb-00ec00c10053.png",
        "timestamp": 1577798792476,
        "duration": 42
    },
    {
        "description": "VerifyProduct Description Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008b006d-006f-007c-00fa-004400c3002b.png",
        "timestamp": 1577798792895,
        "duration": 46
    },
    {
        "description": "VerifyDefault Price Schedule ID label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00430011-002c-005c-007e-00b800b900ee.png",
        "timestamp": 1577798793316,
        "duration": 105
    },
    {
        "description": "Verify Effective Date label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c200bb-0026-00aa-00a3-0028000b0086.png",
        "timestamp": 1577798793798,
        "duration": 45
    },
    {
        "description": "Verify Expiry Date Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003000c7-0037-00f7-0057-00550058004d.png",
        "timestamp": 1577798794222,
        "duration": 52
    },
    {
        "description": "Add a Product Successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00bf00f1-002a-0057-0076-003e00cb0037.png",
        "timestamp": 1577798794641,
        "duration": 25780
    },
    {
        "description": "Verify Title of the ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0049005f-00bd-0067-0072-007100c60092.png",
        "timestamp": 1577798820813,
        "duration": 13
    },
    {
        "description": "Veriy  links present on ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0084009b-0064-00e4-0034-00d5001400d5.png",
        "timestamp": 1577798821188,
        "duration": 866
    },
    {
        "description": "Verify successfull Message that Product has been added|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8160,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'Product has been created successfully.' to contain 'Product has been added'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:324:17\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "007900c2-0070-00c4-0048-00d500980079.png",
        "timestamp": 1577798822418,
        "duration": 82
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000c00b4-0038-0058-00a7-004e00ce0065.png",
        "timestamp": 1577798860606,
        "duration": 25325
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007100ce-00d3-00dd-00ab-00b600570050.png",
        "timestamp": 1577798886368,
        "duration": 14
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f500fb-0055-0036-0096-00e100340048.png",
        "timestamp": 1577798886735,
        "duration": 405
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577798887185,
                "type": ""
            }
        ],
        "screenShotFile": "0080002f-00fe-0033-00cf-006400310072.png",
        "timestamp": 1577798887552,
        "duration": 15
    },
    {
        "description": "product should be added successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c100db-0098-00e0-0085-005900f5002a.png",
        "timestamp": 1577798887918,
        "duration": 6590
    },
    {
        "description": "Verify Create A New Product - Basic Info text|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009b00e5-00af-0016-0079-00b2008f00ee.png",
        "timestamp": 1577798894893,
        "duration": 45
    },
    {
        "description": "Verify Product ID Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00640008-0031-00af-0068-000d007c0022.png",
        "timestamp": 1577798895287,
        "duration": 41
    },
    {
        "description": "Verify Product Name Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00990000-0074-00cc-00fb-0023009f00a0.png",
        "timestamp": 1577798895695,
        "duration": 40
    },
    {
        "description": "VerifyProduct Description Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003100a8-008c-0076-00ab-007800fb0059.png",
        "timestamp": 1577798896100,
        "duration": 70
    },
    {
        "description": "VerifyDefault Price Schedule ID label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00780060-009d-00b0-0026-00740056001d.png",
        "timestamp": 1577798896548,
        "duration": 44
    },
    {
        "description": "Verify Effective Date label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001c00ac-005f-0093-00be-008600dd00f6.png",
        "timestamp": 1577798896975,
        "duration": 49
    },
    {
        "description": "Verify Expiry Date Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001600f8-00a7-00b7-00d4-00fa00230062.png",
        "timestamp": 1577798897382,
        "duration": 42
    },
    {
        "description": "Add a Product Successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e50000-00bf-000b-009f-009e008b0058.png",
        "timestamp": 1577798897899,
        "duration": 25862
    },
    {
        "description": "Verify Title of the ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c4002a-002a-00e6-0002-009300890093.png",
        "timestamp": 1577798924137,
        "duration": 13
    },
    {
        "description": "Veriy  links present on ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0041005f-00c2-00f7-00ca-00bd008e0094.png",
        "timestamp": 1577798924494,
        "duration": 903
    },
    {
        "description": "Verify successfull Message that Product has been added|Addition of the Product",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8508,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected '' to contain 'Product has been created successfully.'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\AddProduct\\AddProduct_spec.js:324:17\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "007f00c4-0066-0030-00ac-00590027001e.png",
        "timestamp": 1577798925760,
        "duration": 137
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004b00aa-0000-00aa-0017-002200d000a3.png",
        "timestamp": 1577798969866,
        "duration": 25061
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001a0042-0037-0074-0029-00840091000c.png",
        "timestamp": 1577798995389,
        "duration": 18
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577798996261,
                "type": ""
            }
        ],
        "screenShotFile": "0083006f-0005-007e-008a-00b1002400f1.png",
        "timestamp": 1577798995779,
        "duration": 508
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ed00dc-0023-001b-00d3-00cf007c0098.png",
        "timestamp": 1577798996704,
        "duration": 20
    },
    {
        "description": "product should be added successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c50051-00ec-00e3-00d9-009f007000f8.png",
        "timestamp": 1577798997111,
        "duration": 6576
    },
    {
        "description": "Verify Create A New Product - Basic Info text|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005f0060-00e1-0060-0079-00dd009a00fc.png",
        "timestamp": 1577799004068,
        "duration": 46
    },
    {
        "description": "Verify Product ID Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004b005e-007a-0046-00bb-008c001a0077.png",
        "timestamp": 1577799004495,
        "duration": 42
    },
    {
        "description": "Verify Product Name Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007600c9-00bf-0026-003d-002700bb00b2.png",
        "timestamp": 1577799004925,
        "duration": 47
    },
    {
        "description": "VerifyProduct Description Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007100eb-008f-0091-00e3-003500200090.png",
        "timestamp": 1577799005336,
        "duration": 52
    },
    {
        "description": "VerifyDefault Price Schedule ID label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001a0033-009e-0073-002e-00aa00da00ad.png",
        "timestamp": 1577799005780,
        "duration": 46
    },
    {
        "description": "Verify Effective Date label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f70087-00e1-0070-00d3-00f0005500d9.png",
        "timestamp": 1577799006201,
        "duration": 43
    },
    {
        "description": "Verify Expiry Date Label|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ec00ed-00fe-008d-002f-00040002003a.png",
        "timestamp": 1577799006602,
        "duration": 42
    },
    {
        "description": "Add a Product Successfully|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007900d3-0002-0088-004c-007a008300fb.png",
        "timestamp": 1577799007001,
        "duration": 25826
    },
    {
        "description": "Verify Title of the ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00150051-0083-0028-0009-006f00ba00bc.png",
        "timestamp": 1577799033214,
        "duration": 12
    },
    {
        "description": "Veriy  links present on ProductPage|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00810050-0073-00d6-001b-0004000e0038.png",
        "timestamp": 1577799033582,
        "duration": 969
    },
    {
        "description": "Verify successfull Message that Product has been added|Addition of the Product",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 720,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00200071-005e-00ba-00d9-007600a50035.png",
        "timestamp": 1577799034916,
        "duration": 92
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00000067-00a8-0075-00d8-00cb005b0029.png",
        "timestamp": 1577802073148,
        "duration": 25181
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002100cb-00af-0055-0061-0061008c00fb.png",
        "timestamp": 1577802098758,
        "duration": 20
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a800c5-000f-00a3-00a7-0054003a0074.png",
        "timestamp": 1577802099141,
        "duration": 389
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577802099598,
                "type": ""
            }
        ],
        "screenShotFile": "008a00f9-00bf-002d-00ff-0058002a00ad.png",
        "timestamp": 1577802099959,
        "duration": 15
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c3003b-00c9-001e-007f-002d0032007a.png",
        "timestamp": 1577802100355,
        "duration": 4495
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577802104941,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577802104942,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577802104942,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577802104942,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577802104942,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577802104943,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577802104943,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577802104943,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577802104943,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577802104943,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577802104944,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577802104944,
                "type": ""
            }
        ],
        "screenShotFile": "00a30030-004d-00b4-002d-00f1009500c5.png",
        "timestamp": 1577802105251,
        "duration": 76
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0003009b-00ae-006a-00da-005600a2001b.png",
        "timestamp": 1577802105696,
        "duration": 13
    },
    {
        "description": "Verify Address Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009100af-007f-00d2-0053-007500070084.png",
        "timestamp": 1577802106120,
        "duration": 71
    },
    {
        "description": "Verify Shipping Text present on Address page|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'Shipping' to contain 'shipping'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:105:17\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "006b0077-00ca-00e7-0090-009900510013.png",
        "timestamp": 1577802106561,
        "duration": 50
    },
    {
        "description": "Verify Billing Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009b008d-0083-0053-00d7-00e6006400cc.png",
        "timestamp": 1577802107013,
        "duration": 44
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'Name' to contain 'name'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:151:17\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "0032006f-006d-002d-00e8-006100660034.png",
        "timestamp": 1577802107440,
        "duration": 108
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005100af-00c0-0084-00e3-00be00a7006b.png",
        "timestamp": 1577802107932,
        "duration": 93
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7280,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "ElementNotVisibleError: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebElement.clear()\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.clear (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2351:17)\n    at actionFn (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as clear] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as clear] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Address.enteradd1 (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\Addresses\\Address.js:121:7)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:212:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Verify Creation of New Address\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:188:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00de0006-002e-00d2-0025-009a002800d7.png",
        "timestamp": 1577802108404,
        "duration": 19308
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8932,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002c007e-007c-00a4-00f4-00cc005b0010.png",
        "timestamp": 1577803010951,
        "duration": 24442
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8932,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0017006d-003a-009a-00ca-009a008900c2.png",
        "timestamp": 1577803035847,
        "duration": 16
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8932,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009e00f3-001a-008a-0076-009f00be00e2.png",
        "timestamp": 1577803036255,
        "duration": 258
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8932,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004e006a-0050-007b-0021-002300320099.png",
        "timestamp": 1577803036917,
        "duration": 63
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8932,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577803037236,
                "type": ""
            }
        ],
        "screenShotFile": "003a0027-00ac-0080-0038-00a0005d004c.png",
        "timestamp": 1577803037405,
        "duration": 4517
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8932,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577803042065,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577803042065,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577803042066,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577803042066,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577803042066,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577803042066,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577803042066,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577803042066,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577803042066,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577803042066,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577803042066,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577803042066,
                "type": ""
            }
        ],
        "screenShotFile": "00c2002f-0029-004e-0040-003500600090.png",
        "timestamp": 1577803042313,
        "duration": 70
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8932,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f80041-0098-001a-0041-007800380002.png",
        "timestamp": 1577803042753,
        "duration": 214
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8932,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'Name' to contain 'name'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:88:17\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a30002-0009-000b-0025-00bd001500e2.png",
        "timestamp": 1577803043336,
        "duration": 61
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8932,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d700a6-00b3-00d5-0072-00f800ca00be.png",
        "timestamp": 1577803043785,
        "duration": 46
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8932,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "ElementNotVisibleError: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebElement.clear()\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.clear (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2351:17)\n    at actionFn (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as clear] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as clear] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Address.enteradd1 (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\Addresses\\Address.js:121:7)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:149:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Verify Creation of New Address\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:125:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "008b0023-0085-000b-001b-00ff00a300bb.png",
        "timestamp": 1577803044239,
        "duration": 19534
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8104,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008900f4-000f-0075-00a0-008d00d30022.png",
        "timestamp": 1577951485875,
        "duration": 28986
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8104,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003600a6-00db-007f-0099-000d00610001.png",
        "timestamp": 1577951515926,
        "duration": 17
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8104,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00890040-0019-001b-00f9-008a00f20073.png",
        "timestamp": 1577951516334,
        "duration": 252
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8104,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ec00be-00c8-00d3-006d-00ec007b00bb.png",
        "timestamp": 1577951516964,
        "duration": 14
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8104,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577951519394,
                "type": ""
            }
        ],
        "screenShotFile": "004d0003-00f5-00ef-008a-009300fd00d6.png",
        "timestamp": 1577951517359,
        "duration": 4487
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8104,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577951521968,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577951521968,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577951521969,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577951521969,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577951521970,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577951521970,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577951521970,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577951521970,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577951521971,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577951521971,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577951521971,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577951521971,
                "type": ""
            }
        ],
        "screenShotFile": "00ba007c-00e8-000d-00a0-004200e000f0.png",
        "timestamp": 1577951522249,
        "duration": 86
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8104,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003b00ab-0028-00ac-00ff-002b006a007a.png",
        "timestamp": 1577951522762,
        "duration": 24
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8104,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'Name' to contain 'name'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:88:17\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c0005c-0044-0067-00e7-005700800099.png",
        "timestamp": 1577951523204,
        "duration": 49
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8104,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0041009a-0083-00cd-000b-00eb004f00b2.png",
        "timestamp": 1577951523645,
        "duration": 63
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8104,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "ElementNotVisibleError: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebElement.clear()\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.clear (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2351:17)\n    at actionFn (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as clear] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as clear] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Address.enteradd1 (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\Addresses\\Address.js:121:7)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:149:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Verify Creation of New Address\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:125:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "0068002c-008e-00d0-00e6-007400c400ef.png",
        "timestamp": 1577951524106,
        "duration": 19447
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8364,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00100052-0018-00d8-0036-005100d600f7.png",
        "timestamp": 1577952409440,
        "duration": 25035
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8364,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008f0082-005c-00a3-000b-0060004c0009.png",
        "timestamp": 1577952435021,
        "duration": 15
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8364,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000f00e3-008b-009a-0006-005c00b90034.png",
        "timestamp": 1577952435413,
        "duration": 242
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8364,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577952435974,
                "type": ""
            }
        ],
        "screenShotFile": "00ad0015-00e4-008b-0051-0054000400b3.png",
        "timestamp": 1577952436157,
        "duration": 27
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8364,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e40077-00d2-00fc-0019-0001003b0099.png",
        "timestamp": 1577952436605,
        "duration": 4512
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8364,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952441237,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952441237,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952441238,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952441238,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952441238,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952441239,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952441239,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952441239,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952441239,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952441239,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952441239,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952441239,
                "type": ""
            }
        ],
        "screenShotFile": "00da00bd-0077-000a-00fb-003f004200b4.png",
        "timestamp": 1577952441549,
        "duration": 82
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8364,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008500c7-005f-0019-00cd-00a6008100eb.png",
        "timestamp": 1577952442036,
        "duration": 27
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8364,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c800c5-0079-005f-000d-0051001e00e8.png",
        "timestamp": 1577952442451,
        "duration": 48
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8364,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000000f9-00a6-0083-00a6-00ec001800ad.png",
        "timestamp": 1577952442887,
        "duration": 46
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8364,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "ElementNotVisibleError: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebElement.clear()\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.clear (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2351:17)\n    at actionFn (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as clear] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as clear] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Address.enteradd1 (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\Addresses\\Address.js:120:7)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:147:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Verify Creation of New Address\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:123:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "007100a4-00f9-00b9-0048-0022004300c6.png",
        "timestamp": 1577952443359,
        "duration": 19465
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007c0071-0087-004f-0003-009a003500df.png",
        "timestamp": 1577952683455,
        "duration": 24293
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002100cb-0021-007e-0094-003f00230041.png",
        "timestamp": 1577952708289,
        "duration": 15
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00730054-00f1-00f6-0015-007f009600d7.png",
        "timestamp": 1577952708694,
        "duration": 250
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00910027-0058-006d-00ed-007000400026.png",
        "timestamp": 1577952709376,
        "duration": 17
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577952709432,
                "type": ""
            }
        ],
        "screenShotFile": "00a100f8-0098-00fe-005f-00e500a800c9.png",
        "timestamp": 1577952709792,
        "duration": 4549
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952714461,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952714461,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952714461,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952714462,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952714463,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952714463,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952714463,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952714463,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952714463,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952714463,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952714463,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952714463,
                "type": ""
            }
        ],
        "screenShotFile": "0077006c-0029-00c3-003c-00e9006a0040.png",
        "timestamp": 1577952714773,
        "duration": 83
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007700c2-007b-00fd-007c-00d500c800d4.png",
        "timestamp": 1577952715254,
        "duration": 24
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00160019-007c-00a9-0066-00ef00c80089.png",
        "timestamp": 1577952715670,
        "duration": 51
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a0065-000a-000e-0082-004800db0062.png",
        "timestamp": 1577952716105,
        "duration": 52
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3716,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009a0030-00bc-0016-0002-0032007100f0.png",
        "timestamp": 1577952716558,
        "duration": 31260
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00110079-00ba-0081-0032-00af00ce005d.png",
        "timestamp": 1577952912178,
        "duration": 24833
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008500e5-00fe-00cf-00ca-00ed001400f5.png",
        "timestamp": 1577952937485,
        "duration": 17
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b10099-000c-0055-00d4-006c00750052.png",
        "timestamp": 1577952937916,
        "duration": 239
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577952938494,
                "type": ""
            }
        ],
        "screenShotFile": "00980035-0031-0032-001b-0020003e008b.png",
        "timestamp": 1577952938622,
        "duration": 30
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000a00a3-006b-0072-00e0-0093007300fe.png",
        "timestamp": 1577952939037,
        "duration": 4793
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952943899,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952943899,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952943899,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952943899,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952943899,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952943900,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952943900,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952943900,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952943900,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952943901,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952943901,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577952943901,
                "type": ""
            }
        ],
        "screenShotFile": "005d003d-00d5-00ab-003e-006e008300b9.png",
        "timestamp": 1577952944253,
        "duration": 79
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d70099-0003-00c5-00fc-0007004800aa.png",
        "timestamp": 1577952944774,
        "duration": 19
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ea00cf-00d8-00c9-0052-00e100d00063.png",
        "timestamp": 1577952945175,
        "duration": 49
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0079007e-00d1-003e-0070-00700067002b.png",
        "timestamp": 1577952945612,
        "duration": 62
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6384,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d70052-0057-0006-0035-00d2001600c2.png",
        "timestamp": 1577952946054,
        "duration": 37534
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1984,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00900083-0015-0021-0055-00e80014004a.png",
        "timestamp": 1577953114381,
        "duration": 24010
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1984,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000500ff-0072-00d4-00c5-00ce000a0017.png",
        "timestamp": 1577953138871,
        "duration": 15
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1984,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003a0042-000f-001c-0072-00ac0010006e.png",
        "timestamp": 1577953139258,
        "duration": 258
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1984,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00700020-00be-002f-007f-005900730076.png",
        "timestamp": 1577953139893,
        "duration": 28
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1984,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577953142356,
                "type": ""
            }
        ],
        "screenShotFile": "0075005e-00ef-0001-00e8-00ca0084002f.png",
        "timestamp": 1577953140318,
        "duration": 4545
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1984,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953144961,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953144961,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953144961,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953144961,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953144961,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953144962,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953144962,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953144962,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953144962,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953144962,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953144962,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953144962,
                "type": ""
            }
        ],
        "screenShotFile": "004600e7-0010-00f8-00f9-007e00a700d8.png",
        "timestamp": 1577953145284,
        "duration": 89
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1984,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002300e5-00a2-0034-00b2-006000a80091.png",
        "timestamp": 1577953145768,
        "duration": 11
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1984,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b200ad-007e-00b8-00a1-00cb00eb009e.png",
        "timestamp": 1577953146160,
        "duration": 497
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1984,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0099005e-00c3-00dc-0019-000900730061.png",
        "timestamp": 1577953147014,
        "duration": 51
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1984,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "ElementNotVisibleError: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebElement.clear()\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.clear (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2351:17)\n    at actionFn (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as clear] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as clear] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Address.enterlname (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\Addresses\\Address.js:99:8)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:140:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Verify Creation of New Address\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:123:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c2003e-00ab-0062-0061-00da00a00009.png",
        "timestamp": 1577953147478,
        "duration": 17884
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9036,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00350065-0079-0038-0032-008a00180084.png",
        "timestamp": 1577953311053,
        "duration": 32011
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9036,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003e00c8-00f3-000f-0047-005200a600e7.png",
        "timestamp": 1577953343551,
        "duration": 21
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9036,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003b00ca-00d2-0086-00a3-00d2005f00bc.png",
        "timestamp": 1577953343971,
        "duration": 471
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9036,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577953344574,
                "type": ""
            }
        ],
        "screenShotFile": "00100087-0095-00f5-00c8-00340025007d.png",
        "timestamp": 1577953344892,
        "duration": 37
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9036,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "ElementNotVisibleError: element not interactable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebElement.click()\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Address.clickonaddressicon (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\Addresses\\Address.js:60:14)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:43:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"click on Address successfully\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:38:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00aa00e8-00b6-0080-00ff-000600270078.png",
        "timestamp": 1577953345338,
        "duration": 8271
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9036,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //button[@class='btn btn-primary float-right mt-3'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //button[@class='btn btn-primary float-right mt-3'])\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:53:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify New Address Button Presence\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:49:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00d900dd-0038-0092-00ae-007f00df0057.png",
        "timestamp": 1577953353994,
        "duration": 4043
    },
    {
        "description": "Verify URL|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9036,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'https://archway-premiernutrition-seller-qa.azurewebsites.net/home' to contain 'addresses'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:65:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "002f0074-002e-0032-003d-008c00490021.png",
        "timestamp": 1577953358424,
        "duration": 14
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9036,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //button[contains(text(),'Name')])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //button[contains(text(),'Name')])\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:82:8)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify name Text present on Address page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:76:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00800084-0083-0061-00c9-00bb001e0077.png",
        "timestamp": 1577953358799,
        "duration": 4064
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9036,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //button[@class='btn btn-link font-weight-bold'][contains(text(),'Address')])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //button[@class='btn btn-link font-weight-bold'][contains(text(),'Address')])\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:107:16)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify Address link in header present on Address page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:101:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "0061004c-00d8-00de-00ab-00e100b500ba.png",
        "timestamp": 1577953363322,
        "duration": 4067
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9036,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //button[@class='btn btn-primary float-right mt-3'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //button[@class='btn btn-primary float-right mt-3'])\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Address.clickonnewaddress (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\Addresses\\Address.js:80:13)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:126:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Verify Creation of New Address\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:123:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "005a00d3-0057-00c7-00d6-009300c60067.png",
        "timestamp": 1577953367785,
        "duration": 8117
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9308,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b300cb-0074-00e9-00e5-004e00e1005b.png",
        "timestamp": 1577953535507,
        "duration": 25343
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9308,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006100cb-0071-0022-002b-000000830082.png",
        "timestamp": 1577953561305,
        "duration": 14
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9308,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006c00ff-00fc-0097-00a9-005500cc005a.png",
        "timestamp": 1577953561709,
        "duration": 247
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9308,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c90012-00f9-00ed-0051-00ad00340040.png",
        "timestamp": 1577953562435,
        "duration": 17
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9308,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577953562562,
                "type": ""
            }
        ],
        "screenShotFile": "00fc0073-00d7-00bf-0022-004b00af006c.png",
        "timestamp": 1577953562840,
        "duration": 4606
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9308,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953567563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953567563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953567563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953567563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953567563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953567563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953567563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953567563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953567563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953567563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953567563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577953567563,
                "type": ""
            }
        ],
        "screenShotFile": "002f0093-0049-0048-0006-0000006500d6.png",
        "timestamp": 1577953567859,
        "duration": 71
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9308,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007c00b0-004c-00b1-00e1-0026002b0073.png",
        "timestamp": 1577953568387,
        "duration": 21
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9308,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004b00ad-00b0-007f-000d-00fc002e00d5.png",
        "timestamp": 1577953568858,
        "duration": 55
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9308,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00840071-0068-001f-00de-0022007b006e.png",
        "timestamp": 1577953569334,
        "duration": 51
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9308,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009000d6-000b-00be-0068-00ee00ab009f.png",
        "timestamp": 1577953569795,
        "duration": 37131
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001800cd-001f-00ed-00cb-00800003003b.png",
        "timestamp": 1577956089256,
        "duration": 33241
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d30016-0051-00a2-0061-002500b00025.png",
        "timestamp": 1577956123014,
        "duration": 20
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0074000e-00ba-0014-0040-008700910098.png",
        "timestamp": 1577956123436,
        "duration": 271
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00020042-0083-00e0-000f-00900059002b.png",
        "timestamp": 1577956124099,
        "duration": 29
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577956126562,
                "type": ""
            }
        ],
        "screenShotFile": "005200e1-0007-0060-002c-00520054001b.png",
        "timestamp": 1577956124513,
        "duration": 4564
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956129187,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956129187,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956129188,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956129188,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956129188,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956129188,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956129189,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956129189,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956129189,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956129189,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956129189,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956129189,
                "type": ""
            }
        ],
        "screenShotFile": "000e00b7-00c6-0092-00f9-001c00da0079.png",
        "timestamp": 1577956129498,
        "duration": 80
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00480029-0058-00f2-0006-00c600aa00ae.png",
        "timestamp": 1577956129953,
        "duration": 11
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006e0086-006e-0006-0066-0001003c0090.png",
        "timestamp": 1577956130352,
        "duration": 52
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006000c8-0043-00fd-0075-0008001d003f.png",
        "timestamp": 1577956130828,
        "duration": 49
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9692,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(xpath, //shared-modal[1]//div[4]//input[1]))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Address.enterlname (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\Addresses\\Address.js:101:8)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:140:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Verify Creation of New Address\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:123:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577956131262,
        "duration": 15850
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9456,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009e00de-000e-00e4-00b8-005100e30047.png",
        "timestamp": 1577956221484,
        "duration": 80193
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9456,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009c005b-005b-00d7-009a-00e0001b004a.png",
        "timestamp": 1577956302186,
        "duration": 21
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9456,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e8004b-007c-001c-00fc-000600460063.png",
        "timestamp": 1577956302594,
        "duration": 360
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9456,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577956302987,
                "type": ""
            }
        ],
        "screenShotFile": "00990091-004e-0066-00fc-00da00780099.png",
        "timestamp": 1577956303394,
        "duration": 36
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9456,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00df0060-00e7-000a-004d-0071009c00b7.png",
        "timestamp": 1577956303821,
        "duration": 4591
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9456,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956308500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956308500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956308500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956308500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956308500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956308500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956308501,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956308501,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956308501,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956308501,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956308501,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577956308501,
                "type": ""
            }
        ],
        "screenShotFile": "00c400db-000f-00a6-0088-002100df0004.png",
        "timestamp": 1577956308832,
        "duration": 96
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9456,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0093001b-00ae-00d4-00b9-007d00a100a2.png",
        "timestamp": 1577956309498,
        "duration": 9
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9456,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00020024-0015-00fe-0071-001100fd0072.png",
        "timestamp": 1577956309885,
        "duration": 66
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9456,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009d00d6-00ef-0029-00bb-005900ac00e9.png",
        "timestamp": 1577956310352,
        "duration": 50
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9456,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: chrome not reachable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "WebDriverError: chrome not reachable\n  (Session info: chrome=79.0.3945.88)\n  (Driver info: chromedriver=79.0.3945.16 (93fcc21110c10dbbd49bbff8f472335360e31d05-refs/branch-heads/3945@{#262}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(xpath, //shared-modal[1]//div[4]//input[1]))\n    at Driver.schedule (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as clear] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as clear] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at Address.enterlname (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\Addresses\\Address.js:99:8)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:147:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Verify Creation of New Address\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:123:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "timestamp": 1577956310791,
        "duration": 25532
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9480,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009900fc-00fd-0017-0096-008c00710040.png",
        "timestamp": 1577957335334,
        "duration": 27137
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9480,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003f00a2-00ff-0055-00dc-002e00f20042.png",
        "timestamp": 1577957362931,
        "duration": 15
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9480,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009200a5-00d9-004b-005b-00a200c90014.png",
        "timestamp": 1577957363331,
        "duration": 248
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9480,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577957363888,
                "type": ""
            }
        ],
        "screenShotFile": "0089000f-009f-00da-006e-006700ad002b.png",
        "timestamp": 1577957364093,
        "duration": 39
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9480,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008100bf-00cd-0049-006b-009d00080046.png",
        "timestamp": 1577957364533,
        "duration": 4452
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9480,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957369112,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957369112,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957369112,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957369112,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957369113,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957369113,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957369113,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957369113,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957369113,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957369114,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957369114,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957369114,
                "type": ""
            }
        ],
        "screenShotFile": "008d00b1-0049-0004-00b4-009800d100c1.png",
        "timestamp": 1577957369376,
        "duration": 76
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9480,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006b001f-00da-00b4-0006-00ca003c00b2.png",
        "timestamp": 1577957369946,
        "duration": 11
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9480,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00520014-0090-003f-00bb-00a100c70095.png",
        "timestamp": 1577957370365,
        "duration": 76
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9480,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000c00c0-0022-00fc-008e-0049005d0034.png",
        "timestamp": 1577957370825,
        "duration": 47
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e2000a-0029-008f-00a5-005c00820038.png",
        "timestamp": 1577957427958,
        "duration": 25698
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007100b9-00a3-00dc-002c-00220097005b.png",
        "timestamp": 1577957454289,
        "duration": 18
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fe009b-00f6-0015-00d5-004a00890011.png",
        "timestamp": 1577957454717,
        "duration": 292
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0075002d-00ca-0058-008f-002700d400ad.png",
        "timestamp": 1577957455409,
        "duration": 35
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577957457891,
                "type": ""
            }
        ],
        "screenShotFile": "0037008c-004e-009b-00eb-005900490012.png",
        "timestamp": 1577957455852,
        "duration": 4558
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957460519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957460519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957460519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957460519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957460520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957460520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957460520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957460520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957460520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957460520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957460521,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577957460521,
                "type": ""
            }
        ],
        "screenShotFile": "00950061-0081-0091-004b-00de00d70006.png",
        "timestamp": 1577957460810,
        "duration": 70
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00dd0000-006a-00fc-0014-00a000cf00c0.png",
        "timestamp": 1577957461263,
        "duration": 12
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008b0096-00f9-008e-00d4-00750086009b.png",
        "timestamp": 1577957461771,
        "duration": 48
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2452,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003d0084-0055-0056-00f6-008100480038.png",
        "timestamp": 1577957462211,
        "duration": 76
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008e0024-0021-0018-00be-00c7005a0097.png",
        "timestamp": 1577958000009,
        "duration": 25431
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006d00bd-00eb-00df-006a-000700e000ce.png",
        "timestamp": 1577958025882,
        "duration": 12
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000200b1-0096-0052-00a8-001900f700c4.png",
        "timestamp": 1577958026285,
        "duration": 212
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected 'https://archway-premiernutrition-seller-qa.azurewebsites.net/login' to contain 'https://archway-premiernutrition-seller-qa.azurewebsites.net/home'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\LoginPage\\LoginPage_spec.js:116:15)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00cb005a-00ab-0040-004d-009200900010.png",
        "timestamp": 1577958026890,
        "duration": 28
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005000ee-0067-000b-001b-000b0037003f.png",
        "timestamp": 1577958027301,
        "duration": 4354
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //button[@class='btn btn-primary float-right mt-3'])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //button[@class='btn btn-primary float-right mt-3'])\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:53:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify New Address Button Presence\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:49:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00770090-00c4-00ad-0000-000a008d000d.png",
        "timestamp": 1577958032044,
        "duration": 4070
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958036795,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958036795,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958036795,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958036796,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958036797,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958036797,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958036797,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958036797,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958036797,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958036798,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958036798,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958036798,
                "type": ""
            }
        ],
        "screenShotFile": "003a0095-00c8-0024-00df-00cb00b5005e.png",
        "timestamp": 1577958036758,
        "duration": 28
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e00c1-00e6-003f-00e2-0076004100a8.png",
        "timestamp": 1577958037179,
        "duration": 2823
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00110074-00d0-0068-0031-00e800410013.png",
        "timestamp": 1577958040415,
        "duration": 78
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: cosnole is not defined"
        ],
        "trace": [
            "ReferenceError: cosnole is not defined\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:173:4\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at runMicrotasks (<anonymous>)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Verify Creation of New Address\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:123:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "008000a8-008b-00ea-0071-0001003b00f0.png",
        "timestamp": 1577958040899,
        "duration": 28572
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008400ab-0062-0093-0048-003800310055.png",
        "timestamp": 1577958140077,
        "duration": 25395
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ed009b-0068-00c9-0038-00780049005d.png",
        "timestamp": 1577958165941,
        "duration": 14
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577958166814,
                "type": ""
            }
        ],
        "screenShotFile": "00220000-002e-0011-000b-0034002b0020.png",
        "timestamp": 1577958166403,
        "duration": 524
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c700b0-0047-0036-0037-00b2002300cc.png",
        "timestamp": 1577958167336,
        "duration": 28
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f4003c-003f-0012-0070-0036000e001d.png",
        "timestamp": 1577958167737,
        "duration": 4650
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958172428,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958172429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958172429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958172429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958172429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958172429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958172429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958172430,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958172430,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958172430,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958172430,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958172431,
                "type": ""
            }
        ],
        "screenShotFile": "0024008c-00c0-000a-00b8-009d00f1001b.png",
        "timestamp": 1577958172783,
        "duration": 69
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000300e7-001c-0073-0057-00bd009500b8.png",
        "timestamp": 1577958173361,
        "duration": 10
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000800ce-00cb-00f1-0078-006600b10067.png",
        "timestamp": 1577958173767,
        "duration": 52
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007b009b-0056-0086-00c4-00780054001e.png",
        "timestamp": 1577958174208,
        "duration": 49
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5976,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: cosnole is not defined"
        ],
        "trace": [
            "ReferenceError: cosnole is not defined\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:173:4\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at runMicrotasks (<anonymous>)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Verify Creation of New Address\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:123:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00cc0011-008f-00ec-0069-00ed008c007b.png",
        "timestamp": 1577958174686,
        "duration": 28659
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7880,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00bd00df-00d5-00b7-0074-003d00130035.png",
        "timestamp": 1577958260556,
        "duration": 27061
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7880,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00cd0086-00bb-00bc-0005-006200af003a.png",
        "timestamp": 1577958288109,
        "duration": 13
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7880,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b3000b-0048-00c0-00e2-002a000c0020.png",
        "timestamp": 1577958288506,
        "duration": 370
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7880,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577958289079,
                "type": ""
            }
        ],
        "screenShotFile": "002f0034-007f-0067-005c-000f00a000fc.png",
        "timestamp": 1577958289289,
        "duration": 36
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7880,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00560049-00f8-007c-00bb-0096003200be.png",
        "timestamp": 1577958289711,
        "duration": 4496
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7880,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958294326,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958294326,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958294326,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958294326,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958294327,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958294327,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958294327,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958294327,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958294327,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958294328,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958294328,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577958294328,
                "type": ""
            }
        ],
        "screenShotFile": "00e6001f-00ad-0084-001b-005e009800f5.png",
        "timestamp": 1577958294600,
        "duration": 71
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7880,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000300c9-00b3-00fc-007c-00c0004f007f.png",
        "timestamp": 1577958295085,
        "duration": 9
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7880,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002e00de-003e-001d-00bc-00bd00bd0043.png",
        "timestamp": 1577958295508,
        "duration": 63
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7880,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003c0065-003e-00a8-0015-001f00a60065.png",
        "timestamp": 1577958295992,
        "duration": 68
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 7880,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00150041-0005-008c-0022-00d300c30038.png",
        "timestamp": 1577958296488,
        "duration": 36651
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9436,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f50068-00b8-0071-0061-005f00d4000d.png",
        "timestamp": 1577959073877,
        "duration": 25774
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9436,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c600b8-0086-002d-0091-000e00160095.png",
        "timestamp": 1577959100119,
        "duration": 17
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9436,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006a00e5-007a-00bb-008c-00900072007c.png",
        "timestamp": 1577959100539,
        "duration": 344
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9436,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577959101005,
                "type": ""
            }
        ],
        "screenShotFile": "00f70057-0076-0094-00f2-006900b100e8.png",
        "timestamp": 1577959101310,
        "duration": 42
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9436,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ca0044-003c-0021-0075-009000f800d2.png",
        "timestamp": 1577959101750,
        "duration": 4505
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9436,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959106402,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959106403,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959106405,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959106406,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959106407,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959106408,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959106408,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959106409,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959106409,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959106410,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959106411,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959106413,
                "type": ""
            }
        ],
        "screenShotFile": "003b005f-0032-006c-00a3-00e000c60070.png",
        "timestamp": 1577959106669,
        "duration": 75
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9436,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0043009f-00b5-00d2-001a-0037000700f8.png",
        "timestamp": 1577959107154,
        "duration": 12
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9436,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00670015-0011-0033-002a-00a700f20039.png",
        "timestamp": 1577959107581,
        "duration": 47
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9436,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006700db-00d9-0073-0027-00130054009a.png",
        "timestamp": 1577959108006,
        "duration": 54
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9436,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003d0079-0046-00bf-0009-0054001a002b.png",
        "timestamp": 1577959108488,
        "duration": 34962
    },
    {
        "description": "validation check|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9436,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //span[contains(text(),'City is required')])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //span[contains(text(),'City is required')])\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at runMicrotasks (<anonymous>)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:211:11)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"validation check\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:204:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "004f0067-00a7-00fd-0097-00e40099004c.png",
        "timestamp": 1577959143975,
        "duration": 8058
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005500f3-00bc-004d-005f-00d600c7005f.png",
        "timestamp": 1577959323663,
        "duration": 25973
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000d0003-0050-0004-00d3-00c00030004c.png",
        "timestamp": 1577959350131,
        "duration": 18
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00790014-00a1-005d-0005-00a100a6002d.png",
        "timestamp": 1577959350553,
        "duration": 356
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577959351065,
                "type": ""
            }
        ],
        "screenShotFile": "00bd0074-006d-009f-00b4-003400d60007.png",
        "timestamp": 1577959351327,
        "duration": 28
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004800a1-0016-00cf-00d8-0049007a007c.png",
        "timestamp": 1577959351737,
        "duration": 4453
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959356336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959356336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959356336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959356336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959356336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959356336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959356336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959356336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959356336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959356336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959356336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577959356336,
                "type": ""
            }
        ],
        "screenShotFile": "002e000a-006f-005e-0055-00a500f10074.png",
        "timestamp": 1577959356601,
        "duration": 71
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00eb0010-00c3-00b0-0077-0025002f00ea.png",
        "timestamp": 1577959357077,
        "duration": 11
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e3008c-00be-00b6-00d4-00df00670055.png",
        "timestamp": 1577959357485,
        "duration": 62
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003600db-00fa-00c2-0051-001b00c20081.png",
        "timestamp": 1577959357937,
        "duration": 68
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c900bd-0088-00cd-0014-000d004f0003.png",
        "timestamp": 1577959358436,
        "duration": 35450
    },
    {
        "description": "validation check|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 6616,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: Invalid locator"
        ],
        "trace": [
            "TypeError: Invalid locator\n    at Object.check [as checkedLocator] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\by.js:275:9)\n    at WebElement.findElements (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2072:18)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:170:46\n    at Array.map (<anonymous>)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:167:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"validation check\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:204:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e700bf-0067-0024-004f-001200ad008d.png",
        "timestamp": 1577959394381,
        "duration": 27
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00bf0082-0062-00c5-00ed-008400e40065.png",
        "timestamp": 1577960547325,
        "duration": 37566
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008300b7-000a-0078-005f-003200d800d8.png",
        "timestamp": 1577960585393,
        "duration": 22
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a700a7-0000-000e-0093-0028001b00d8.png",
        "timestamp": 1577960585885,
        "duration": 384
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577960586280,
                "type": ""
            }
        ],
        "screenShotFile": "0026005c-0017-00db-001c-00a8008d0095.png",
        "timestamp": 1577960586672,
        "duration": 34
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ee004c-001b-00bc-0022-009900380072.png",
        "timestamp": 1577960587109,
        "duration": 4548
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960591732,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960591732,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960591732,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960591732,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960591732,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960591733,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960591733,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960591733,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960591733,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960591734,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960591734,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960591734,
                "type": ""
            }
        ],
        "screenShotFile": "0070000f-0080-0075-00ee-00b200ea00fb.png",
        "timestamp": 1577960592056,
        "duration": 71
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d700ce-0072-0036-00a4-005a00bd00b9.png",
        "timestamp": 1577960592524,
        "duration": 11
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004c007a-003f-00aa-00f0-00f9007d0000.png",
        "timestamp": 1577960592942,
        "duration": 84
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b600b5-00cf-00c1-0002-00250014000b.png",
        "timestamp": 1577960593418,
        "duration": 57
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00940042-009d-0077-007b-007a00920022.png",
        "timestamp": 1577960593904,
        "duration": 35440
    },
    {
        "description": "validation check|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8596,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: callback is not defined"
        ],
        "trace": [
            "ReferenceError: callback is not defined\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:212:44)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at runMicrotasks (<anonymous>)\nFrom: Task: Run it(\"validation check\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:204:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c300d5-0083-0080-0039-0002001600d6.png",
        "timestamp": 1577960629805,
        "duration": 5
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006d00e0-0016-000a-00fd-009900650068.png",
        "timestamp": 1577960801409,
        "duration": 26581
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004b00d1-00ba-00a3-0003-00d600dd004d.png",
        "timestamp": 1577960828458,
        "duration": 14
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000e006b-0081-0050-0040-007f0065002a.png",
        "timestamp": 1577960828864,
        "duration": 253
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577960829448,
                "type": ""
            }
        ],
        "screenShotFile": "0079003c-0062-00bf-006d-00c600170002.png",
        "timestamp": 1577960829632,
        "duration": 15
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000800d5-0079-0032-0014-006400ea0086.png",
        "timestamp": 1577960830045,
        "duration": 4478
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960834626,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960834626,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960834626,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960834626,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960834627,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960834629,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960834629,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960834629,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960834629,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960834629,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960834629,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960834629,
                "type": ""
            }
        ],
        "screenShotFile": "00de0017-0014-0072-00b9-005c00ab0077.png",
        "timestamp": 1577960834962,
        "duration": 75
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f5001e-009e-0082-009a-00f1004a00e8.png",
        "timestamp": 1577960835464,
        "duration": 17
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002f00e1-00b2-0053-0099-0037000f00ec.png",
        "timestamp": 1577960835869,
        "duration": 70
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00510015-0092-003a-000c-004000290047.png",
        "timestamp": 1577960836364,
        "duration": 54
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004d0091-0084-0034-00f5-000d00550030.png",
        "timestamp": 1577960836832,
        "duration": 35560
    },
    {
        "description": "validation check|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4960,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: callback is not defined"
        ],
        "trace": [
            "ReferenceError: callback is not defined\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:212:44)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at runMicrotasks (<anonymous>)\nFrom: Task: Run it(\"validation check\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:204:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "003800c1-00d1-0090-004c-00f70040008c.png",
        "timestamp": 1577960872846,
        "duration": 6
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006c003f-001b-001a-00cc-00e900fb0035.png",
        "timestamp": 1577960961930,
        "duration": 24472
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00230065-001f-00ef-00b7-00d40013000d.png",
        "timestamp": 1577960986899,
        "duration": 14
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e10041-00d3-00b0-0019-005000b0007e.png",
        "timestamp": 1577960987320,
        "duration": 406
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577960987781,
                "type": ""
            }
        ],
        "screenShotFile": "006e004a-00df-0034-008f-00cb00840010.png",
        "timestamp": 1577960988145,
        "duration": 14
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001b0048-002b-0058-00e3-004800b9007c.png",
        "timestamp": 1577960988587,
        "duration": 4494
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960993196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960993196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960993196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960993196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960993196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960993196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960993196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960993196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960993196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960993196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960993196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577960993196,
                "type": ""
            }
        ],
        "screenShotFile": "009c00f8-0082-0039-00dc-00f100190082.png",
        "timestamp": 1577960993516,
        "duration": 70
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004800e5-00f1-0009-006a-000400db00db.png",
        "timestamp": 1577960994001,
        "duration": 36
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e200bc-008a-00b1-0051-00b6001600cb.png",
        "timestamp": 1577960994456,
        "duration": 49
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003100e3-002e-0029-004b-00d900310091.png",
        "timestamp": 1577960994924,
        "duration": 45
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ea00fa-004c-00b7-0073-002e008e00c9.png",
        "timestamp": 1577960995399,
        "duration": 35033
    },
    {
        "description": "validation check|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 8580,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: callback is not defined"
        ],
        "trace": [
            "ReferenceError: callback is not defined\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:212:44)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at runMicrotasks (<anonymous>)\nFrom: Task: Run it(\"validation check\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:204:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e700ef-00ae-00d5-006a-0095008b0000.png",
        "timestamp": 1577961030920,
        "duration": 7
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f00029-00c3-0086-00fa-00650079008b.png",
        "timestamp": 1577961094075,
        "duration": 30209
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007f00ff-0025-002f-003c-0052002000e0.png",
        "timestamp": 1577961124821,
        "duration": 15
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006b001c-0023-00bf-0009-007b007400c4.png",
        "timestamp": 1577961125252,
        "duration": 400
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577961125663,
                "type": ""
            }
        ],
        "screenShotFile": "00cd0027-00cb-0032-0074-000100bc00ea.png",
        "timestamp": 1577961126083,
        "duration": 14
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003500a0-00ea-0041-0021-00d100660086.png",
        "timestamp": 1577961126491,
        "duration": 4543
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961131146,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961131148,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961131149,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961131149,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961131149,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961131149,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961131150,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961131150,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961131151,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961131151,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961131152,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961131152,
                "type": ""
            }
        ],
        "screenShotFile": "00ba0085-0063-00b3-009a-00e8008a0041.png",
        "timestamp": 1577961131441,
        "duration": 70
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ac00ea-00a3-00ff-00ee-004d00f90011.png",
        "timestamp": 1577961131918,
        "duration": 10
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003700d0-0065-0046-00e1-00d7001d004e.png",
        "timestamp": 1577961132355,
        "duration": 69
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0010002e-00c5-00f6-0066-00eb00a300e5.png",
        "timestamp": 1577961132840,
        "duration": 54
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d400d5-005d-000e-00b4-00fc004400ed.png",
        "timestamp": 1577961133306,
        "duration": 35318
    },
    {
        "description": "validation check|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9824,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: callback is not a function"
        ],
        "trace": [
            "TypeError: callback is not a function\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\Addresses\\Address.js:174:13\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at runMicrotasks (<anonymous>)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"validation check\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:204:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "008b008c-00d4-009d-0071-008e00f100c2.png",
        "timestamp": 1577961169105,
        "duration": 4117
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6324,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005b0076-000b-003f-0068-004400d90079.png",
        "timestamp": 1577961264835,
        "duration": 26731
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6324,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00440089-009e-006f-0036-00950019005b.png",
        "timestamp": 1577961292037,
        "duration": 15
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6324,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008f00ef-007a-00c4-0056-009300e00095.png",
        "timestamp": 1577961292471,
        "duration": 432
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6324,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577961292927,
                "type": ""
            }
        ],
        "screenShotFile": "00dd00eb-00f5-000c-008c-001300b60062.png",
        "timestamp": 1577961293327,
        "duration": 17
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6324,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00670093-0078-0060-00e3-000c0037002b.png",
        "timestamp": 1577961293732,
        "duration": 4667
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6324,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961298473,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961298473,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961298474,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961298474,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961298474,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961298474,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961298474,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961298474,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961298474,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961298475,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961298475,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577961298475,
                "type": ""
            }
        ],
        "screenShotFile": "0016002e-00fb-00f7-0090-000500670064.png",
        "timestamp": 1577961298808,
        "duration": 71
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6324,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0058006d-00ec-000d-0029-00b0008100aa.png",
        "timestamp": 1577961299279,
        "duration": 16
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6324,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00750015-0096-00c6-0097-00e500ab0002.png",
        "timestamp": 1577961299730,
        "duration": 67
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6324,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00950026-00af-0020-00ae-0058006a005b.png",
        "timestamp": 1577961300208,
        "duration": 52
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6324,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ac00a6-0080-0046-00bf-005c00f000c8.png",
        "timestamp": 1577961300656,
        "duration": 35221
    },
    {
        "description": "validation check|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 6324,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: callback is not a function"
        ],
        "trace": [
            "TypeError: callback is not a function\n    at C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\pageobjects\\Addresses\\Address.js:174:13\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at runMicrotasks (<anonymous>)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"validation check\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:204:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00af00b3-008c-009b-00f7-004900400027.png",
        "timestamp": 1577961336322,
        "duration": 4022
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9444,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00450074-00e9-00b2-00d7-00e9006100a0.png",
        "timestamp": 1577962129297,
        "duration": 38534
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9444,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002f00c2-00e8-0004-0053-00f700880058.png",
        "timestamp": 1577962168348,
        "duration": 14
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9444,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00790080-0082-001d-00ec-00fa00d30074.png",
        "timestamp": 1577962168760,
        "duration": 349
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9444,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577962169278,
                "type": ""
            }
        ],
        "screenShotFile": "00c00002-0049-0068-00d7-003700d100a8.png",
        "timestamp": 1577962169536,
        "duration": 18
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9444,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f600f4-00e9-0085-0007-005700cc00f2.png",
        "timestamp": 1577962169965,
        "duration": 4505
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9444,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962174584,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962174584,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962174584,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962174584,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962174585,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962174585,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962174585,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962174585,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962174586,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962174586,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962174586,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962174587,
                "type": ""
            }
        ],
        "screenShotFile": "000200eb-006c-00b3-00d1-00d100bc008c.png",
        "timestamp": 1577962174896,
        "duration": 86
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9444,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001f0005-0033-0091-00f3-006200a600f9.png",
        "timestamp": 1577962175389,
        "duration": 35
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9444,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c2003a-006e-0064-007b-006d00ea0056.png",
        "timestamp": 1577962175834,
        "duration": 55
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9444,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0081001a-006c-0011-001b-00a3001700b2.png",
        "timestamp": 1577962176288,
        "duration": 54
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9444,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00430032-00a0-0059-0049-00a8003e0064.png",
        "timestamp": 1577962176752,
        "duration": 35358
    },
    {
        "description": "validation check|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9444,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Expected ElementFinder({ browser_: ProtractorBrowser({ controlFlow: Function, schedule: Function, setFileDetector: Function, getExecutor: Function, getSession: Function, getCapabilities: Function, quit: Function, actions: Function, touchActions: Function, executeScript: Function, executeAsyncScript: Function, call: Function, wait: Function, sleep: Function, getWindowHandle: Function, getAllWindowHandles: Function, getPageSource: Function, close: Function, getCurrentUrl: Function, getTitle: Function, findElementInternal_: Function, findElementsInternal_: Function, takeScreenshot: Function, manage: Function, switchTo: Function, driver: Driver({ flow_: ControlFlow::9418\n| TaskQueue::9401\n| | (pending) Task::9400<Run it(\"validation check\") in control flow>\n| | | (active) TaskQueue::9404\n| | | | Task::9407<Ignore Synchronization Protractor.waitForAngular()>\n| | | | Task::9409<then>\n| | | | Task::9411<then>\n| | | | Task::9413<then>\n| | | | Task::9415<then>\n| | | | Task::9417<then>\n| | Task::9403<then>, session_: ManagedPromise::4 {[[PromiseStatus]]: \"fulfilled\"}, executor_: Executor({ w3c: false, customCommands_: Map( [ 'launchApp', Object({ method: 'POST', path: '/session/:sessionId/chromium/launch_app' }) ], [ 'getNetworkConditions', Object({ method: 'GET', path: '/session/:sessionId/chromium/network_conditions' }) ], [ 'setNetworkConditions', Object({ method: 'POST', path: '/session/:sessionId/chromium/network_conditions' }) ], [ 'getNetworkConnection', Object({ method: 'GET', path: '/session/:sessionId/network_connection' }) ], [ 'setNetworkConnection', Object({ method: 'POST', path: '/session/:sessionId/network_connection' }) ], [ 'toggleAirplaneMode', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_airplane_mode' }) ], [ 'toggleWiFi', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_wifi' }) ], [ 'toggleData', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_data' }) ], [ 'toggleLocationServices', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_location_services' }) ], [ 'getGeolocation', Object({ method: 'GET', path: '/session/:sessionId/location' }) ], [ 'setGeolocation', Object({ method: 'POST', path: '/session/:sessionId/location' }) ], [ 'getCurrentDeviceActivity', Object({ method: 'GET', path: '/session/:sessionId/appium/device/current_activity' }) ], [ 'startDeviceActivity', Object({ method: 'POST', path: '/session/:sessionId/appium/device/start_activity' }) ], [ 'getAppiumSettings', Object({ method: 'GET', path: '/session/:sessionId/appium/settings' }) ], [ 'setAppiumSettings', Object({ method: 'POST', path: '/session/:sessionId/appium/settings' }) ], [ 'getCurrentContext', Object({ method: 'GET', path: '/session/:sessionId/context' }) ], [ 'selectContext', Object({ method: 'POST', path: '/session/:sessionId/context' }) ], [ 'getScreenOrientation', Object({ method: 'GET', path: '/session/:sessionId/orientation' }) ], [ 'setScreenOrientation', Object({ method: 'POST', path: '/session/:sessionId/orientation' }) ], [ 'isDeviceLocked', Object({ method: 'POST', path: '/session/:sessionId/appium/device/is_locked' }) ], [ 'lockDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/lock' }) ], [ 'unlockDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/unlock' }) ], [ 'installApp', Object({ method: 'POST', path: '/session/:sessionId/appium/device/install_app' }) ], [ 'isAppInstalled', Object({ method: 'POST', path: '/session/:sessionId/appium/device/app_installed' }) ], [ 'removeApp', Object({ method: 'POST', path: '/session/:sessionId/appium/device/remove_app' }) ], [ 'pullFileFromDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/pull_file' }) ], [ 'pullFolderFromDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/pull_folder' }) ], [ 'pushFileToDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/push_file' }) ], [ 'listContexts', Object({ method: 'GET', path: '/session/:sessionId/contexts' }) ], [ 'uploadFile', Object({ method: 'POST', path: '/session/:sessionId/file' }) ], [ 'switchToParentFrame', Object({ method: 'POST', path: '/session/:sessionId/frame/parent' }) ], [ 'fullscreen', Object({ method: 'POST', path: '/session/:sessionId/window/fullscreen' }) ], [ 'sendAppToBackground', Object({ method: 'POST', path: '/session/:sessionId/appium/app/background' }) ], [ 'closeApp', Object({ method: 'POST', path: '/session/:sessionId/appium/app/close' }) ], [ 'getAppStrings', Object({ method: 'POST', path: '/session/:sessionId/appium/app/strings' }) ], [ 'launchSession', Object({ method: 'POST', path: '/session/:sessionId/appium/app/launch' }) ], [ 'resetApp', Object({ method: 'POST', path: '/session/:sessionId/appium/app/reset' }) ], [ 'hideSoftKeyboard', Object({ method: 'POST', path: '/session/:sessionId/appium/device/hide_keyboard' }) ], [ 'getDeviceTime', Object({ method: 'GET', path: '/session/:sessionId/appium/device/system_time' }) ], [ 'openDeviceNotifications', Object({ method: 'POST', path: '/session/:sessionId/appium/device/open_notifications' }) ], [ 'rotationGesture', Object({ method: 'POST', path: '/session/:sessionId/appium/device/rotate' }) ], [ 'shakeDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/shake' }) ], [ 'sendChromiumCommand', Object({ method: 'POST', path: '/session/:sessionId/chromium/send_command' }) ], [ 'sendChromiumCommandAndGetResult', Object({ method: 'POST', path: '/session/:sessionId/chromium/send_command_and_get_result' }) ] ), log_: Logger({ name_: 'webdriver.http.Executor', level_: null, parent_: Logger({ name_: 'webdriver.http', level_: null, parent_: Logger({ name_: 'webdriver', level_: null, parent_: Logger({ name_: '', level_: OFF, parent_: null, handlers_: null }), handlers_: null }), handlers_: null }), handlers_: null }) }), fileDetector_: null, onQuit_: undefined, getNetworkConnection: Function, setNetworkConnection: Function, toggleAirplaneMode: Function, toggleWiFi: Function, toggleData: Function, toggleLocationServices: Function, getGeolocation: Function, setGeolocation: Function, getCurrentDeviceActivity: Function, startDeviceActivity: Function, getAppiumSettings: Function, setAppiumSettings: Function, getCurrentContext: Function, selectContext: Function, getScreenOrientation: Function, setScreenOrientation: Function, isDeviceLocked: Function, lockDevice: Function, unlockDevice: Function, installApp: Function, isAppInstalled: Function, removeApp: Function, pullFileFromDevice: Function, pullFolderFromDevice: Function, pushFileToDevice: Function, listContexts: Function, uploadFile: Function, switchToParentFrame: Function, fullscreen: Function, sendAppToBackground: Function, closeApp: Function, getAppStrings: Function, launchSession: Function, resetApp: Function, hideSoftKeyboard: Function, getDeviceTime: Function, openDeviceNotifications: Function, rotationGesture: Function, shakeDevice: Function, sendChromiumCommand: Function, sendChromiumCommandAndGetResult: Function }), element: Function, $: Function, $: Function, baseUrl: '', getPageTimeout: 10000, params: Object({  }), resetUrl: 'data:text/html,<html></html>', debugHelper: DebugHelper({ browserUnderDebug_: <circular reference: Object> }), ready: ManagedPromise::17 {[[PromiseStatus]]: \"fulfilled\"}, trackOutstandingTimeouts_: true, mockModules_: [ Object({ name: 'protractorBaseModule_', script: Function, args: [ true ] }) ], ExpectedConditions: ProtractorExpectedConditions({ browser: <circular reference: Object> }), plugins_: Plugins({ setup: Function, onPrepare: Function, teardown: Function, postResults: Function, postTest: Function, onPageLoad: Function, onPageStable: Function, waitForPromise: Function, waitForCondition: Function, pluginObjs: [  ], assertions: Object({  }), resultsReported: false }), allScriptsTimeout: 2500000, getProcessedConfig: Function, forkNewDriverInstance: Function, restart: Function, restartSync: Function, internalRootEl: '', internalIgnoreSynchronization: true }), then: null, parentElementArrayFinder: ElementArrayFinder({ browser_: ProtractorBrowser({ controlFlow: Function, schedule: Function, setFileDetector: Function, getExecutor: Function, getSession: Function, getCapabilities: Function, quit: Function, actions: Function, touchActions: Function, executeScript: Function, executeAsyncScript: Function, call: Function, wait: Function, sleep: Function, getWindowHandle: Function, getAllWindowHandles: Function, getPageSource: Function, close: Function, getCurrentUrl: Function, getTitle: Function, findElementInternal_: Function, findElementsInternal_: Function, takeScreenshot: Function, manage: Function, switchTo: Function, driver: Driver({ flow_: ControlFlow::9418\n| TaskQueue::9401\n| | (pending) Task::9400<Run it(\"validation check\") in control flow>\n| | | (active) TaskQueue::9404\n| | | | Task::9407<Ignore Synchronization Protractor.waitForAngular()>\n| | | | Task::9409<then>\n| | | | Task::9411<then>\n| | | | Task::9413<then>\n| | | | Task::9415<then>\n| | | | Task::9417<then>\n| | Task::9403<then>, session_: ManagedPromise::4 {[[PromiseStatus]]: \"fulfilled\"}, executor_: Executor({ w3c: false, customCommands_: Map( [ 'launchApp', Object({ method: 'POST', path: '/session/:sessionId/chromium/launch_app' }) ], [ 'getNetworkConditions', Object({ method: 'GET', path: '/session/:sessionId/chromium/network_conditions' }) ], [ 'setNetworkConditions', Object({ method: 'POST', path: '/session/:sessionId/chromium/network_conditions' }) ], [ 'getNetworkConnection', Object({ method: 'GET', path: '/session/:sessionId/network_connection' }) ], [ 'setNetworkConnection', Object({ method: 'POST', path: '/session/:sessionId/network_connection' }) ], [ 'toggleAirplaneMode', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_airplane_mode' }) ], [ 'toggleWiFi', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_wifi' }) ], [ 'toggleData', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_data' }) ], [ 'toggleLocationServices', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_location_services' }) ], [ 'getGeolocation', Object({ method: 'GET', path: '/session/:sessionId/location' }) ], [ 'setGeolocation', Object({ method: 'POST', path: '/session/:sessionId/location' }) ], [ 'getCurrentDeviceActivity', Object({ method: 'GET', path: '/session/:sessionId/appium/device/current_activity' }) ], [ 'startDeviceActivity', Object({ method: 'POST', path: '/session/:sessionId/appium/device/start_activity' }) ], [ 'getAppiumSettings', Object({ method: 'GET', path: '/session/:sessionId/appium/settings' }) ], [ 'setAppiumSettings', Object({ method: 'POST', path: '/session/:sessionId/appium/settings' }) ], [ 'getCurrentContext', Object({ method: 'GET', path: '/session/:sessionId/context' }) ], [ 'selectContext', Object({ method: 'POST', path: '/session/:sessionId/context' }) ], [ 'getScreenOrientation', Object({ method: 'GET', path: '/session/:sessionId/orientation' }) ], [ 'setScreenOrientation', Object({ method: 'POST', path: '/session/:sessionId/orientation' }) ], [ 'isDeviceLocked', Object({ method: 'POST', path: '/session/:sessionId/appium/device/is_locked' }) ], [ 'lockDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/lock' }) ], [ 'unlockDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/unlock' }) ], [ 'installApp', Object({ method: 'POST', path: '/session/:sessionId/appium/device/install_app' }) ], [ 'isAppInstalled', Object({ method: 'POST', path: '/session/:sessionId/appium/device/app_installed' }) ], [ 'removeApp', Object({ method: 'POST', path: '/session/:sessionId/appium/device/remove_app' }) ], [ 'pullFileFromDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/pull_file' }) ], [ 'pullFolderFromDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/pull_folder' }) ], [ 'pushFileToDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/push_file' }) ], [ 'listContexts', Object({ method: 'GET', path: '/session/:sessionId/contexts' }) ], [ 'uploadFile', Object({ method: 'POST', path: '/session/:sessionId/file' }) ], [ 'switchToParentFrame', Object({ method: 'POST', path: '/session/:sessionId/frame/parent' }) ], [ 'fullscreen', Object({ method: 'POST', path: '/session/:sessionId/window/fullscreen' }) ], [ 'sendAppToBackground', Object({ method: 'POST', path: '/session/:sessionId/appium/app/background' }) ], [ 'closeApp', Object({ method: 'POST', path: '/session/:sessionId/appium/app/close' }) ], [ 'getAppStrings', Object({ method: 'POST', path: '/session/:sessionId/appium/app/strings' }) ], [ 'launchSession', Object({ method: 'POST', path: '/session/:sessionId/appium/app/launch' }) ], [ 'resetApp', Object({ method: 'POST', path: '/session/:sessionId/appium/app/reset' }) ], [ 'hideSoftKeyboard', Object({ method: 'POST', path: '/session/:sessionId/appium/device/hide_keyboard' }) ], [ 'getDeviceTime', Object({ method: 'GET', path: '/session/:sessionId/appium/device/system_time' }) ], [ 'openDeviceNotifications', Object({ method: 'POST', path: '/session/:sessionId/appium/device/open_notifications' }) ], [ 'rotationGesture', Object({ method: 'POST', path: '/session/:sessionId/appium/device/rotate' }) ], [ 'shakeDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/shake' }) ], [ 'sendChromiumCommand', Object({ method: 'POST', path: '/session/:sessionId/chromium/send_command' }) ], [ 'sendChromiumCommandAndGetResult', Object({ method: 'POST', path: '/session/:sessionId/chromium/send_command_and_get_result' }) ] ), log_: Logger({ name_: 'webdriver.http.Executor', level_: null, parent_: Logger({ name_: 'webdriver.http', level_: null, parent_: Logger({ name_: 'webdriver', level_: null, parent_: Logger({ name_: '', level_: OFF, parent_: null, handlers_: null }), handlers_: null }), handlers_: null }), handlers_: null }) }), fileDetector_: null, onQuit_: undefined, getNetworkConnection: Function, setNetworkConnection: Function, toggleAirplaneMode: Function, toggleWiFi: Function, toggleData: Function, toggleLocationServices: Function, getGeolocation: Function, setGeolocation: Function, getCurrentDeviceActivity: Function, startDeviceActivity: Function, getAppiumSettings: Function, setAppiumSettings: Function, getCurrentContext: Function, selectContext: Function, getScreenOrientation: Function, setScreenOrientation: Function, isDeviceLocked: Function, lockDevice: Function, unlockDevice: Function, installApp: Function, isAppInstalled: Function, removeApp: Function, pullFileFromDevice: Function, pullFolderFromDevice: Function, pushFileToDevice: Function, listContexts: Function, uploadFile: Function, switchToParentFrame: Function, fullscreen: Function, sendAppToBackground: Function, closeApp: Function, getAppStrings: Function, launchSession: Function, resetApp: Function, hideSoftKeyboard: Function, getDeviceTime: Function, openDeviceNotifications: Function, rotationGesture: Function, shakeDevice: Function, sendChromiumCommand: Function, sendChromiumCommandAndGetResult: Function }), element: Function, $: Function, $: Function, baseUrl: '', getPageTimeout: 10000, params: Object({  }), resetUrl: 'data:text/html,<html></html>', debugHelper: DebugHelper({ browserUnderDebug_: <circular reference: Object> }), ready: ManagedPromise::17 {[[PromiseStatus]]: \"fulfilled\"}, trackOutstandingTimeouts_: true, mockModules_: [ Object({ name: 'protractorBaseModule_', script: Function, args: [ true ] }) ], ExpectedConditions: ProtractorExpectedConditions({ browser: <circular reference: Object> }), plugins_: Plugins({ setup: Function, onPrepare: Function, teardown: Function, postResults: Function, postTest: Function, onPageLoad: Function, onPageStable: Function, waitForPromise: Function, waitForCondition: Function, pluginObjs: [  ], assertions: Object({  }), resultsReported: false }), allScriptsTimeout: 2500000, getProcessedConfig: Function, forkNewDriverInstance: Function, restart: Function, restartSync: Function, internalRootEl: '', internalIgnoreSynchronization: true }), getWebElements: Function, locator_: By(xpath, //span[contains(text(),'City is required')]), actionResults_: null, click: Function, sendKeys: Function, getTagName: Function, getCssValue: Function, getAttribute: Function, getText: Function, getSize: Function, getLocation: Function, isEnabled: Function, isSelected: Function, submit: Function, clear: Function, isDisplayed: Function, getId: Function, takeScreenshot: Function }), elementArrayFinder_: ElementArrayFinder({ browser_: ProtractorBrowser({ controlFlow: Function, schedule: Function, setFileDetector: Function, getExecutor: Function, getSession: Function, getCapabilities: Function, quit: Function, actions: Function, touchActions: Function, executeScript: Function, executeAsyncScript: Function, call: Function, wait: Function, sleep: Function, getWindowHandle: Function, getAllWindowHandles: Function, getPageSource: Function, close: Function, getCurrentUrl: Function, getTitle: Function, findElementInternal_: Function, findElementsInternal_: Function, takeScreenshot: Function, manage: Function, switchTo: Function, driver: Driver({ flow_: ControlFlow::9418\n| TaskQueue::9401\n| | (pending) Task::9400<Run it(\"validation check\") in control flow>\n| | | (active) TaskQueue::9404\n| | | | Task::9407<Ignore Synchronization Protractor.waitForAngular()>\n| | | | Task::9409<then>\n| | | | Task::9411<then>\n| | | | Task::9413<then>\n| | | | Task::9415<then>\n| | | | Task::9417<then>\n| | Task::9403<then>, session_: ManagedPromise::4 {[[PromiseStatus]]: \"fulfilled\"}, executor_: Executor({ w3c: false, customCommands_: Map( [ 'launchApp', Object({ method: 'POST', path: '/session/:sessionId/chromium/launch_app' }) ], [ 'getNetworkConditions', Object({ method: 'GET', path: '/session/:sessionId/chromium/network_conditions' }) ], [ 'setNetworkConditions', Object({ method: 'POST', path: '/session/:sessionId/chromium/network_conditions' }) ], [ 'getNetworkConnection', Object({ method: 'GET', path: '/session/:sessionId/network_connection' }) ], [ 'setNetworkConnection', Object({ method: 'POST', path: '/session/:sessionId/network_connection' }) ], [ 'toggleAirplaneMode', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_airplane_mode' }) ], [ 'toggleWiFi', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_wifi' }) ], [ 'toggleData', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_data' }) ], [ 'toggleLocationServices', Object({ method: 'POST', path: '/session/:sessionId/appium/device/toggle_location_services' }) ], [ 'getGeolocation', Object({ method: 'GET', path: '/session/:sessionId/location' }) ], [ 'setGeolocation', Object({ method: 'POST', path: '/session/:sessionId/location' }) ], [ 'getCurrentDeviceActivity', Object({ method: 'GET', path: '/session/:sessionId/appium/device/current_activity' }) ], [ 'startDeviceActivity', Object({ method: 'POST', path: '/session/:sessionId/appium/device/start_activity' }) ], [ 'getAppiumSettings', Object({ method: 'GET', path: '/session/:sessionId/appium/settings' }) ], [ 'setAppiumSettings', Object({ method: 'POST', path: '/session/:sessionId/appium/settings' }) ], [ 'getCurrentContext', Object({ method: 'GET', path: '/session/:sessionId/context' }) ], [ 'selectContext', Object({ method: 'POST', path: '/session/:sessionId/context' }) ], [ 'getScreenOrientation', Object({ method: 'GET', path: '/session/:sessionId/orientation' }) ], [ 'setScreenOrientation', Object({ method: 'POST', path: '/session/:sessionId/orientation' }) ], [ 'isDeviceLocked', Object({ method: 'POST', path: '/session/:sessionId/appium/device/is_locked' }) ], [ 'lockDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/lock' }) ], [ 'unlockDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/unlock' }) ], [ 'installApp', Object({ method: 'POST', path: '/session/:sessionId/appium/device/install_app' }) ], [ 'isAppInstalled', Object({ method: 'POST', path: '/session/:sessionId/appium/device/app_installed' }) ], [ 'removeApp', Object({ method: 'POST', path: '/session/:sessionId/appium/device/remove_app' }) ], [ 'pullFileFromDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/pull_file' }) ], [ 'pullFolderFromDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/pull_folder' }) ], [ 'pushFileToDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/push_file' }) ], [ 'listContexts', Object({ method: 'GET', path: '/session/:sessionId/contexts' }) ], [ 'uploadFile', Object({ method: 'POST', path: '/session/:sessionId/file' }) ], [ 'switchToParentFrame', Object({ method: 'POST', path: '/session/:sessionId/frame/parent' }) ], [ 'fullscreen', Object({ method: 'POST', path: '/session/:sessionId/window/fullscreen' }) ], [ 'sendAppToBackground', Object({ method: 'POST', path: '/session/:sessionId/appium/app/background' }) ], [ 'closeApp', Object({ method: 'POST', path: '/session/:sessionId/appium/app/close' }) ], [ 'getAppStrings', Object({ method: 'POST', path: '/session/:sessionId/appium/app/strings' }) ], [ 'launchSession', Object({ method: 'POST', path: '/session/:sessionId/appium/app/launch' }) ], [ 'resetApp', Object({ method: 'POST', path: '/session/:sessionId/appium/app/reset' }) ], [ 'hideSoftKeyboard', Object({ method: 'POST', path: '/session/:sessionId/appium/device/hide_keyboard' }) ], [ 'getDeviceTime', Object({ method: 'GET', path: '/session/:sessionId/appium/device/system_time' }) ], [ 'openDeviceNotifications', Object({ method: 'POST', path: '/session/:sessionId/appium/device/open_notifications' }) ], [ 'rotationGesture', Object({ method: 'POST', path: '/session/:sessionId/appium/device/rotate' }) ], [ 'shakeDevice', Object({ method: 'POST', path: '/session/:sessionId/appium/device/shake' }) ], [ 'sendChromiumCommand', Object({ method: 'POST', path: '/session/:sessionId/chromium/send_command' }) ], [ 'sendChromiumCommandAndGetResult', Object({ method: 'POST', path: '/session/:sessionId/chromium/send_command_and_get_result' }) ] ), log_: Logger({ name_: 'webdriver.http.Executor', level_: null, parent_: Logger({ name_: 'webdriver.http', level_: null, parent_: Logger({ name_: 'webdriver', level_: null, parent_: Logger({ name_: '', level_: OFF, parent_: null, handlers_: null }), handlers_: null }), handlers_: null }), handlers_: null }) }), fileDetector_: null, onQuit_: undefined, getNetworkConnection: Function, setNetworkConnection: Function, toggleAirplaneMode: Function, toggleWiFi: Function, toggleData: Function, toggleLocationServices: Function, getGeolocation: Function, setGeolocation: Function, getCurrentDeviceActivity: Function, startDeviceActivity: Function, getAppiumSettings: Function, setAppiumSettings: Function, getCurrentContext: Function, selectContext: Function, getScreenOrientation: Function, setScreenOrientation: Function, isDeviceLocked: Function, lockDevice: Function, unlockDevice: Function, installApp: Function, isAppInstalled: Function, removeApp: Function, pullFileFromDevice: Function, pullFolderFromDevice: Function, pushFileToDevice: Function, listContexts: Function, uploadFile: Function, switchToParentFrame: Function, fullscreen: Function, sendAppToBackground: Function, closeApp: Function, getAppStrings: Function, launchSession: Function, resetApp: Function, hideSoftKeyboard: Function, getDeviceTime: Function, openDeviceNotifications: Function, rotationGesture: Function, shakeDevice: Function, sendChromiumCommand: Function, sendChromiumCommandAndGetResult: Function }), element: Function, $: Function, $: Function, baseUrl: '', getPageTimeout: 10000, params: Object({  }), resetUrl: 'data:text/html,<html></html>', debugHelper: DebugHelper({ browserUnderDebug_: <circular reference: Object> }), ready: ManagedPromise::17 {[[PromiseStatus]]: \"fulfilled\"}, trackOutstandingTimeouts_: true, mockModules_: [ Object({ name: 'protractorBaseModule_', script: Function, args: [ true ] }) ], ExpectedConditions: ProtractorExpectedConditions({ browser: <circular reference: Object> }), plugins_: Plugins({ setup: Function, onPrepare: Function, teardown: Function, postResults: Function, postTest: Function, onPageLoad: Function, onPageStable: Function, waitForPromise: Function, waitForCondition: Function, pluginObjs: [  ], assertions: Object({  }), resultsReported: false }), allScriptsTimeout: 2500000, getProcessedConfig: Function, forkNewDriverInstance: Function, restart: Function, restartSync: Function, internalRootEl: '', internalIgnoreSynchronization: true }), getWebElements: Function, locator_: By(xpath, //span[contains(text(),'City is required')]), actionResults_: null, click: Function, sendKeys: Function, getTagName: Function, getCssValue: Function, getAttribute: Function, getText: Function, getSize: Function, getLocation: Function, isEnabled: Function, isSelected: Function, submit: Function, clear: Function, isDisplayed: Function, getId: Function, takeScreenshot: Function }), click: Function, sendKeys: Function, getTagName: Function, getCssValue: Function, getAttribute: Function, getText: Function, getSize: Function, getLocation: Function, isEnabled: Function, isSelected: Function, submit: Function, clear: Function, isDisplayed: Function, getId: Function, takeScreenshot: Function }) to contain 'City is required'.",
            "Failed: No element found using locator: By(xpath, //span[contains(text(),'City is required')])"
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:215:23)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "NoSuchElementError: No element found using locator: By(xpath, //span[contains(text(),'City is required')])\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at runMicrotasks (<anonymous>)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:212:19)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"validation check\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:204:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "003b0095-009e-00fc-0099-005700790090.png",
        "timestamp": 1577962212579,
        "duration": 4044
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000e00af-0057-00ff-008d-005e003f0098.png",
        "timestamp": 1577962546052,
        "duration": 24139
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b90024-00e0-00b3-00dd-00e600600061.png",
        "timestamp": 1577962570697,
        "duration": 16
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005d00bc-008a-005c-00b8-005c00440061.png",
        "timestamp": 1577962571132,
        "duration": 363
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577962571555,
                "type": ""
            }
        ],
        "screenShotFile": "003600d2-00c4-00c1-009a-004300e300e1.png",
        "timestamp": 1577962571904,
        "duration": 15
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ee00fe-0080-007e-0039-002800ed0004.png",
        "timestamp": 1577962572331,
        "duration": 4637
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962577014,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962577014,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962577014,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962577014,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962577014,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962577014,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962577014,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962577014,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962577014,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962577015,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962577015,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962577015,
                "type": ""
            }
        ],
        "screenShotFile": "0026005b-00b9-0059-0016-00e2000500bd.png",
        "timestamp": 1577962577440,
        "duration": 227
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009d00f6-0060-0069-00f8-000200f6002f.png",
        "timestamp": 1577962578061,
        "duration": 24
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00270099-007d-0069-00fb-00e70002007e.png",
        "timestamp": 1577962578482,
        "duration": 62
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009d0008-00f2-00dd-0040-00000005001d.png",
        "timestamp": 1577962578946,
        "duration": 49
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0083007b-0050-006f-008a-00af002100be.png",
        "timestamp": 1577962579452,
        "duration": 45512
    },
    {
        "description": "validation check|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6108,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004900d7-0057-006b-0025-0069006700a9.png",
        "timestamp": 1577962625480,
        "duration": 4016
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9096,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d0001c-008e-001c-00a7-00870000009f.png",
        "timestamp": 1577962851588,
        "duration": 25364
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9096,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00470089-00a2-00b3-000c-00d700ec00c4.png",
        "timestamp": 1577962877443,
        "duration": 12
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9096,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0029005a-0063-003d-00b5-00ce004e0048.png",
        "timestamp": 1577962877857,
        "duration": 246
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9096,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577962878509,
                "type": ""
            }
        ],
        "screenShotFile": "00e7000e-006b-00d3-00d1-00ef00700029.png",
        "timestamp": 1577962878501,
        "duration": 17
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9096,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f600d6-009a-0089-0096-0021002d00eb.png",
        "timestamp": 1577962878913,
        "duration": 4557
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9096,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962883613,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962883613,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962883613,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962883613,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962883613,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962883613,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962883613,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962883613,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962883614,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962883614,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962883614,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577962883614,
                "type": ""
            }
        ],
        "screenShotFile": "00370027-00ac-0015-00bf-006900450025.png",
        "timestamp": 1577962883888,
        "duration": 87
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9096,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fb00a5-0083-00d8-00fb-002b00eb00d0.png",
        "timestamp": 1577962884370,
        "duration": 24
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9096,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0016006e-00a5-0086-0078-0030000a00a6.png",
        "timestamp": 1577962884794,
        "duration": 59
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9096,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006500f2-00f2-00f9-00ae-00b4007c007d.png",
        "timestamp": 1577962885246,
        "duration": 64
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9096,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f70036-00eb-006e-0047-0052003f00d4.png",
        "timestamp": 1577962885748,
        "duration": 35110
    },
    {
        "description": "validation check|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9096,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //span[contains(text(),'City is required')])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //span[contains(text(),'City is required')])\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at runMicrotasks (<anonymous>)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:210:14)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"validation check\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:204:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a20073-00d3-00a1-0023-00b600b500c1.png",
        "timestamp": 1577962921357,
        "duration": 4029
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4244,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c0001c-0068-009a-004c-007400f900b9.png",
        "timestamp": 1577964837310,
        "duration": 27992
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4244,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006700c9-0026-007b-00f0-0009007d001c.png",
        "timestamp": 1577964865857,
        "duration": 20
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4244,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577964866721,
                "type": ""
            }
        ],
        "screenShotFile": "005c0080-0011-0064-00e9-002600cc00d3.png",
        "timestamp": 1577964866341,
        "duration": 546
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4244,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e60070-00b3-00cf-0031-009c001000c7.png",
        "timestamp": 1577964867362,
        "duration": 17
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4244,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000c007e-0051-00f3-00ea-0055001b00e6.png",
        "timestamp": 1577964867855,
        "duration": 4560
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4244,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577964872507,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577964872507,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577964872508,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577964872508,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577964872508,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577964872508,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577964872509,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577964872509,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577964872509,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577964872509,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577964872509,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577964872509,
                "type": ""
            }
        ],
        "screenShotFile": "00fa0086-000c-00e9-001e-00f9009700f0.png",
        "timestamp": 1577964872827,
        "duration": 82
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4244,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c400d6-0070-00ab-00ec-00d6002900e5.png",
        "timestamp": 1577964873331,
        "duration": 23
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4244,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00280018-00d1-008b-003d-006a001400b6.png",
        "timestamp": 1577964873799,
        "duration": 55
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4244,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00070062-00a6-00e1-006a-009b0091003a.png",
        "timestamp": 1577964874257,
        "duration": 74
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4244,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: Cannot read property 'then' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'then' of undefined\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:199:35)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Verify Creation of New Address\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:123:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "002e00b5-0027-0083-0005-0039005700fe.png",
        "timestamp": 1577964874777,
        "duration": 61
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2640,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00270035-00e5-0004-0065-00a400ed0021.png",
        "timestamp": 1577966734522,
        "duration": 28090
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2640,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006d0009-0008-009d-00d4-00260070009b.png",
        "timestamp": 1577966763108,
        "duration": 15
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2640,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007500c2-0070-00f6-00f9-001600ca00c8.png",
        "timestamp": 1577966763563,
        "duration": 308
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2640,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1577966764323,
                "type": ""
            }
        ],
        "screenShotFile": "0025001b-0084-0080-0081-008a00190073.png",
        "timestamp": 1577966764392,
        "duration": 20
    },
    {
        "description": "click on Address successfully|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2640,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e1007b-006d-0012-007b-00fa00a1000d.png",
        "timestamp": 1577966764823,
        "duration": 4532
    },
    {
        "description": "Verify New Address Button Presence|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2640,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #AddressName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577966769486,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #City: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577966769487,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #CompanyName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577966769487,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Country: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577966769487,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #FirstName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577966769487,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577966769488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #LastName: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577966769488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Phone: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577966769488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #State: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577966769488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street1: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577966769488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #Street2: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577966769488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/addresses - [DOM] Found 2 elements with non-unique id #zipCode: (More info: https://goo.gl/9p2vKq) %o %o",
                "timestamp": 1577966769488,
                "type": ""
            }
        ],
        "screenShotFile": "008800dd-007e-00e5-0046-003b004c0044.png",
        "timestamp": 1577966769763,
        "duration": 75
    },
    {
        "description": "Verify URL|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2640,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003b00b9-000c-0063-007d-00ba009100e6.png",
        "timestamp": 1577966770225,
        "duration": 12
    },
    {
        "description": "Verify name Text present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2640,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e50070-00d3-00c8-004b-002100f1004f.png",
        "timestamp": 1577966770664,
        "duration": 240
    },
    {
        "description": "Verify Address link in header present on Address page|verify address",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2640,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00410075-003e-0078-00b8-002700fd0089.png",
        "timestamp": 1577966771331,
        "duration": 64
    },
    {
        "description": "Verify Creation of New Address|verify address",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 2640,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": [
            "Failed: Cannot read property 'then' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'then' of undefined\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:199:35)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Verify Creation of New Address\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:123:2)\n    at addSpecsToSuite (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\NareshS\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\NareshS\\eclipse-workspace\\protrract\\PM_Seller\\specs\\Addresses\\Address_spec.js:21:1)\n    at Module._compile (internal/modules/cjs/loader.js:956:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\n    at Module.load (internal/modules/cjs/loader.js:812:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:724:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "009a006f-006f-0020-00af-000500c9006e.png",
        "timestamp": 1577966771797,
        "duration": 63
    },
    {
        "description": "should login the user|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008d0083-0094-00ed-00f9-003600ae00ad.png",
        "timestamp": 1578053429893,
        "duration": 26420
    },
    {
        "description": "verify the title of the Page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://archway-premiernutrition-seller-qa.azurewebsites.net/home - [DOM] Found 3 elements with non-unique id #ID: (More info: https://goo.gl/9p2vKq) %o %o %o",
                "timestamp": 1578053457821,
                "type": ""
            }
        ],
        "screenShotFile": "00be0096-00a3-0012-003b-00c000eb0017.png",
        "timestamp": 1578053456968,
        "duration": 3086
    },
    {
        "description": "veriy all links present on page|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fc00dd-003d-0087-0096-0033008a00a5.png",
        "timestamp": 1578053460465,
        "duration": 487
    },
    {
        "description": "Verify User has looged successfully|Login Page - ",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1784,
        "browser": {
            "name": "chrome",
            "version": "79.0.3945.88"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007b0040-00be-000a-00ba-004600b400b3.png",
        "timestamp": 1578053461328,
        "duration": 25
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
