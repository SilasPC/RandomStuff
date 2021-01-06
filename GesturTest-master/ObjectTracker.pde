
class ObjectTracker extends ObjectFinder {
  
  private final int intersectionSlack = 0;
 
  final ArrayList<ArrayList<Obj>> frameBuffer;
  final int bufferLength;
  
  protected HashMap<Obj,ArrayList<Obj>> lastHistories = new HashMap();
  protected ArrayList<TrackedObj> tracked = new ArrayList();
  
  ObjectTracker(int res, int bufferLength, Capture cam) {
    super(res, cam);
    this.bufferLength = bufferLength;
    this.frameBuffer = new ArrayList();
    this.frameBuffer.add(new ArrayList());
  }
  
  TrackedObj track(Obj obj) {
    for (TrackedObj tObj : this.tracked)
    if (tObj.obj == obj) return tObj;
    TrackedObj tObj = new TrackedObj(obj);
    this.tracked.add(tObj);
    return tObj;
  }
  
  HashMap<Obj,ArrayList<Obj>> process() {
    
    this.findObjects();
    
    this.lastHistories = new HashMap();
    // Loop through objects currently on screen
    for (Obj obj : this.objects) {
      
      // Set up history for object
      ArrayList<Obj> history = new ArrayList();
      this.lastHistories.put(obj,history);
      
      // Search for history
      Obj lastObj = obj;
      frameLoop:
      for (ArrayList<Obj> frame : this.frameBuffer) {
        for (Obj fObj : frame) {
          if (!fObj.intersectsWith(lastObj,this.intersectionSlack)) continue;
          // An object in previous frame was found to be connected
          history.add(fObj);
          lastObj = fObj;
          continue frameLoop;
        }
        // No more history found
        break;
      }
      
    }
    
    // Pop and unshift frameBuffer
    if (this.frameBuffer.size() >= this.bufferLength) this.frameBuffer.remove(this.frameBuffer.size()-1);
    this.frameBuffer.add(0,this.objects);
    
    this.updateTrackedObjects();
    
    return this.lastHistories;
    
  }
  
  private void updateTrackedObjects() {
    // List of tracked objects that are still alive
    ArrayList<TrackedObj> alive = new ArrayList();
    trackedLoop:
    for (TrackedObj tObj : this.tracked) {
      for (Obj objKey : this.lastHistories.keySet())
      for (Obj obj : this.lastHistories.get(objKey))
      if (obj == tObj.obj) {
        // Found tObj.obj in history, update so tObj.obj is a history-key
        tObj.obj = objKey;
        // Mark as alive
        alive.add(tObj);
        // Continue with next tracked obj
        continue trackedLoop;
      }
      // Tracked obj not found in history, declare dead
      tObj.obj = null;
    }
    // Update list of tracked objects
    tracked = alive;
  }
  
  // Return dead tracked object. Useful to avoid null-pointer exceptions for the lazies
  TrackedObj getNullTrackedObj() {return new TrackedObj(null);}
  
  // Inner class bound to instance
  class TrackedObj {
  
    private Obj obj;
    
    TrackedObj (Obj obj) {
      this.obj = obj;
    }
    
    Obj getObj() {return this.obj;}
    boolean isAlive() {return this.obj != null;}
    ArrayList<Obj> getHistory() {return ObjectTracker.this.lastHistories.get(this.obj);}
    
    void drawTrace() {
      
      if (!this.isAlive()) throw new Error("Cannot draw trace of dead TrackedObj");
      
      pushStyle();
    
      int w = ObjectTracker.this.cam.width / res;
      int h = ObjectTracker.this.cam.height / res;
      
      this.obj.drawBoundary(w,h);
      
      stroke(255,0,0);
      strokeWeight(5);
      noFill();
      beginShape();
      ArrayList<Obj> history = ObjectTracker.this.lastHistories.get(this.obj);
      for (Obj obj : history) {
        vertex(
          w*(obj.xMax+obj.xMin)/2,
          h*(obj.yMax+obj.yMin)/2
        );
      }
      endShape();
      noStroke();
      
      popStyle();
      
    }
  
  }
  
}
