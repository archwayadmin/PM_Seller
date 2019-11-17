
var HtmlReporter = require('protractor-beautiful-reporter');
exports.config = {
		
  framework: 'jasmine',
  directConnect: true,

  //seleniumAddress: 'http://localhost:4444/wd/hub',
  
allScriptsTimeout:2500000,
  
  jasmineNodeOpts: {defaultTimeoutInterval: 2500000},
  
 // specs: ['./Smoke/*spec.js'], // if you want to run all test cases for a group like smoke
  
  // so this will be the syantx.
  
  //specs: ['./test_spec/exception.js'],
  
  //specs: ['./specs/AddProduct/AddProduct_spec.js'],
  
  specs: ['./TestLogin_spec.js'],
  
  //specs: ['./specs/LoginPage/LoginPage_spec.js'],
  
  
  
  
  //specs: ['./test_spec/exception.js'],
 // specs: ['./Smoke/*spec.js'],  // to run all test cases under smoke folder
  
  suites:{
	  
	  //protractor conf.js --suite login,AddProduct  ----> to run the suite in order
	  
	  
	  
	  login:'./specs/LoginPage/LoginPage_spec.js',
	  
    AddProduct:'./specs/AddProduct/AddProduct_spec.js',
	  
	  AddCategory:'./specs/AddCategory/AddCategory_spec.js',
	  
	  AddUser:'./specs/Users/User_spec.js',
	  
	 
	  
	  smoke:['./Smoke/*spec.js'],
	  
	  testcase:['./test_spec/*spec.js'],
	  
	  functional:['./Functional/*spec.js'],
	  
	  regression:['./Regression/*spec.js'],
	  
	  all:['./*/*spec.js'],
	  
	  selected:['./specs/LoginPage/LoginPage_spec.js'],
	  
	  // run through suites as per your choice which test cases you want to run
	  
	  
	  
	  
  },
  
  onPrepare: function () {
      browser.manage().window().maximize();

      var AllureReporter = require('jasmine-allure-reporter');
      jasmine.getEnv().addReporter(new AllureReporter({
          resultsDir: './node_modules/jasmine-allure-reporter/allure-results/'
      }));

      jasmine.getEnv().afterEach(function (done) {
          browser.takeScreenshot().then(function (png) {
              allure.createAttachment('Screenshot', function () {
                  return new Buffer(png, 'base64')
              }, 'image/png')();
              done();
          });
      });
  },
  
 
  
  onPrepare: function() {
      // Add a screenshot reporter and store screenshots to `/tmp/screenshots`:
      jasmine.getEnv().addReporter(new HtmlReporter({
         baseDirectory: 'Reports/screenshots'
      }).getJasmine2Reporter());
   },
   
   
   
   
  
  
};