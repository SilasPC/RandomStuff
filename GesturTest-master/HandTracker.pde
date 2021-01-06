
class HandTracker extends ObjectTracker {
  
  HandTracker (int res, int bufferLength, Capture cam) {
    super(res,bufferLength,cam);
  }
  
  void tmpHandThing(ObjectTracker.TrackedObj tObj) {
    
    Obj obj = tObj.getObj();
    
    for (int x = obj.xMin; x < obj.xMax; x++)
    for (int y = obj.yMin; y < obj.yMax; y++) {
      
    }
    
  }
  
}
