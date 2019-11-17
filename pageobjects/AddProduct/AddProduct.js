

var OR= require('./../../json/objects.json');

var addProduct;

addProduct= function(){
	
	var masterMenuOption=element(by.xpath("//button[contains(text(),'Master Menu')]"));
	
	var ProductOPtion=element(by.xpath("//a[contains(text(),'Products')]"));
	
	var newProduct=element(by.xpath("//button[@class='btn btn-primary float-right mt-3 ng-star-inserted']"));
	
	var productId=element(by.xpath("//input[@id='ID']"));
	
	var productName=element(by.xpath("//input[@id='name']"));
	
	var productDescription=element(by.xpath("//textarea[@id='description']"));
	
	var saveButton=element(by.xpath("//button[@class='btn btn-primary mt-4 w-100']"));
	
	var chkbox=element(by.xpath("//input[@id='active']"));
	
	var effectiveDate=element(by.xpath("//input[@placeholder='Effective date']"));
	
	var expiryDate=element(by.xpath("//input[@placeholder='Expiry date']"));
	

	
	
	
	
	
	this.enterDate=function(value){
		
		element(by.xpath("//input[@placeholder='Effective date']")).sendKeys(value);
		
	};
	
	this.clickOnMastermenu= function(){
		
		masterMenuOption.click();
		
	};
	
	this.clickOnProduct= function(){
		
		ProductOPtion.click();
		
	};
	
	this.clickOnNewProductIcon= function(){
		
		newProduct.click();
		
	};
	
	this.enterProductId= function(value){
		
		productId.sendKeys(value);
		
	};
	
	this.enterProductName= function(value){
		
		productName.sendKeys(value);
		
	};
	
	this.enterProductDescription= function(value){
		
		productDescription.sendKeys(value)
		
	};
	
	this.clickOnSaveButton= function(){
		
		saveButton.click();
		
	};
	
	this.clickOnCheckbox= function(){
		
		chkbox.click();
		
		
	};
	
	this.enterEffectiveDate= function(value){
		
		effectiveDate.sendKeys(value);
		
	};
	
   this.enterExpirDate= function(value){
		
	expiryDate.sendKeys(value);
		
	};
	
	this.datePicker=function(){
		
		browser.executeScript("document.getElementsByName(name)")
		
	};
	
	
};

module.exports= new addProduct();