
var async = require("jasmine-await");

describe("df", function() {
	
	
	
	it("wff",  async  function() {
		
		
		 await browser.get('http://www.angularjs.org');

		      await element(by.model('yourName')).sendKeys('Julie');

		    var greeting = element(by.binding('yourName'));

		
		
	});
	
	
});