var AddCategory;

AddCategory= function(){
	
var masterMenuIcon=element(by.xpath("//button[contains(text(),'Master Menu')]"));
	
var categoryLink=	element(by.xpath("//a[contains(text(),'Categories')]"));

var newCategoryLink= element(by.xpath("//button[@class='btn btn-primary float-right mt-3']"));

var categoryId= element(by.xpath("//input[@id='ID']"));

var categoryName= element(by.xpath("//input[@id='name']"));

var categoryDescription= element(by.xpath("//textarea[@id='description']"));

var clickOnCreateBtn= element(by.xpath("//button[@class='btn btn-primary mt-4 w-100']"));

this.clickOnMasterMenu= function(){
	
	
	masterMenuIcon.click();
}




this.clickOnCategoryLink= function(){
	
	categoryLink.click();
	
};

this.clickOnNewCategoryLink= function(){
	
	newCategoryLink.click();
	
};

this.enterValueInCategoryId= function(value){
	
	categoryId.sendKeys(value);
	
};

this.enterValueInCategoryName= function(value){
	
	categoryName.sendKeys(value);
	
};

this.enterValueInDescription= function(value){
	
	categoryDescription.sendKeys(value);
	
};

this.clickOnCreateButton= function(){
	
	clickOnCreateBtn.click();
	
};


	
	

	
};

module.exports= new AddCategory();
