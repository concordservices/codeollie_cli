const {FileOperations}=require('./dist/fileOps.js');
(async () => {
  try {
    const f = new FileOperations();
    await f.createFile('test/codeollie-activity/hello_world.py', 'print("Hello World")');
    const c = await f.readFile('test/codeollie-activity/hello_world.py');
    console.log('READ->', c);
    const lst = await f.listFiles('test');
    console.log('LIST->', lst.join(';'));
  } catch (e) {
    console.error('TEST ERR', e);
  }
})();
