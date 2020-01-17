var loginPageObj = require('./../../pageobjects/LoginPage/LoginPage.js');

var addProduct= require('./../../pageobjects/AddProduct/AddProduct.js');

var page = require('./../../pageobjects/BasePage/BasePage.js');

var homepageobj = require('./../../pageobjects/HomePage/HomePage.js');

var OR = require('./../../json/objects.json');

var logger= require('./../../log');

var selectwraper= require('./../../Select-Wrapper.js');

var myselect= new selectwraper(by.xpath("//select[@id='languageid']"));


describe("Verify Home Page", function() {
	
beforeEach(function() {
		

        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 200000;
     });

     afterEach(function() {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
     });
     
     browser.ignoreSynchronization = true;
	
	
	
	it("Presence of Premeir Nutrition Admin", function() {
		
	var ele=element(by.xpath("//a[@class='nav-link navbar-brand text-white']"));
	
	expect(ele).toBeTruthy();
		
		
		
		
		
	});
	
	
it("Presence of Master Menu", function() {
	
	var mastermenu=element(by.xpath("//button[contains(text(),'Master Menu')]"));
	
	expect(mastermenu).toBeTruthy();
		
		
		
	});
	


it("Presence Admin", function() {
	
var admin=	element(by.xpath("//button[contains(text(),'Admin')]"));

expect(admin).toBeTruthy();
	
	
	
});




it("Presence of  Premier Nutrition Seller text", function() {
	
	var ele=element(by.xpath("//h1[@class='display-4']"));
	
	
	expect(ele).toContain("Premier Nutrition Seller");
	
	
	
});


it("Presence of  Logout", function() {
	
	var logout= logelement(by.xpath("//a[@class='nav-link text-white']"));
	
	expect(logout).toBeTruthy();
	
	
});

});




describe("Verify Order Summary", function() {
	
	
	
	
	
	
});



describe("Verify Users Summary", function() {
	
	
	
	
	
	
});



describe("Verify Ordering Trend For Last 7 Days", function() {
	
	
	
	
	
	
});


describe("Verify Announcements", function() {
	
	
	
	
	
});




describe("Verify Carousel Slides", function() {
	
	
	
	
	
});




