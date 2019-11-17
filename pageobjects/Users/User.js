var users;

users = function() {

	var userIcon = element(by.xpath("//a[contains(text(),'Users')]"));
	

	var newUserIcon = element(by
			.xpath("//button[@class='btn btn-primary float-right mt-3']"));

	var fname = element(by
			.xpath("//div[@id='userFormNew']//input[@id='FirstName']"));

	var sname = element(by
			.xpath("//div[@id='userFormNew']//input[@id='LastName']"));
	


	var emailFields = element(by
			.xpath("//div[@id='userFormNew']//input[@id='Email']"));

	var usernameField = element(by
			.xpath("//div[@id='userFormNew']//input[@id='Username']"));

	var phoneField = element(by
			.xpath("//div[@id='userFormNew']//input[@id='Phone']"));

	var activeChkbox = element(by.xpath("//div[@id='userFormNew']//label[contains(text(),'Active')]"));

	var group = element(by
			.xpath("//div[@id='userFormNew']//form[@name='UserForm']//div[@class='col-sm-12']//div[@class='form-group row']//div[@class='col-sm-6']//ng-multiselect-dropdown[@id='UserGroups']//div[@class='multiselect-dropdown']//div//span[@class='dropdown-btn']"));
	
	var selectall=  element(by.xpath("//div[@id='userFormNew']//div[contains(text(),'Select All')]"));
	
	var createIcon= element(by.xpath("//button[contains(text(),'Create')]"));

	this.clickOnUserIcon = function() {

		userIcon.click();

	};

	this.clickOnNewUserIcon = function() {

		newUserIcon.click();

	};

	this.enterFirstName = function(value) {

		fname.sendKeys(value);

	};

	this.enterSecondName = function(value) {

		sname.sendKeys(value)
	};

	this.enterEmail = function(value) {

		emailFields.sendKeys(value);

	};

	this.enterUsername = function(value) {

		usernameField.sendKeys(value);
	};
	
	this.clickOnUserGroup= function(){
		
		group.click();
		
	};
	
	this.clickOnSelectAll= function(){
		
		
		selectall.click();
		
		
	};

	this.enterphonenumber = function(value) {

		phoneField.sendKeys(value)

	 };

	this.clickonCheckbox = function() {

		activeChkbox.click();

	};
	
	this.clickOnCreateButton= function(){
		
		
		createIcon.click();
		
		
		
	};
	
	
	
	

};

module.exports = new users();