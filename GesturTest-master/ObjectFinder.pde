
class ObjectFinder extends Pixelizer {
  
  // Minimum accepted object size
  private final int minObjectSize = 50;
  // This is how far apart two objects can be and still intersect / merge
  private final int mergeTolerance = 1;
  // Maximum allowed perimeter before throwing error
  private final int maxPerimeter = 1000;
  
  protected ArrayList<Obj> objects = new ArrayList<Obj>();
  
  ObjectFinder(int res, Capture cam) {
    super(res,cam);
  }
  
  ArrayList<Obj> findObjects() {
    
    this.pixelize();
    this.objects = new ArrayList<Obj>();
    
    for (int x = 0; x < this.res; x++)
    for (int y = 0; y < this.res; y++)
    if (this.pixelized[x][y] > 0) this.detectObject(x,y);
    
    this.mergeObjects();
    
    return this.objects;
    
  }
  
  private void mergeObjects() {
    mergeLoop:
    while (true) {
      // This is not optimal, but perfomance isn't
      // really a problem because there are usually very few objects
      for (Obj o1 : this.objects)
      for (Obj o2 : this.objects) {
        if (o1 == o2) continue;
        Obj m = o1.merge(o2,this.mergeTolerance);
        if (m != null) {
          // No concurrent modification happens... 
          this.objects.remove(o1);
          this.objects.remove(o2);
          this.objects.add(m);
          // ...because here we break out of the for loops,
          // that would otherwise throw a ConcurrentModificationException
          continue mergeLoop;
        }
      }
      // No more merges to be done
      return;
    }
  }
  
  // Checks if pixel at coordinates is non-zero
  // Invalid coordinates return false
  private boolean isAt(int x, int y) {
    if (
      x < 0 || x > this.res-1 ||
      y < 0 || y > this.res-1
    ) return false;
    return this.pixelized[x][y] > 0;
  }
    
  // Edge detection algorithm 
  private void detectObject(int x0, int y0) {
    
    /* if (useDebug) {
      fill(0);
      text('I',x0*w+w/2,y0*h+h/2);
    }*/
    
    // Check if this point resides within another object
    // If so, ignore this point
    for (Obj obj : this.objects)
      if (obj.contains(x0,y0)) return;
      
    // Find an edge
    while (this.isAt(x0,y0-1)) y0--;
    
    int x = x0, y = y0;
    // Boundary coordinates
    int xMin = x, xMax = x, yMin = y, yMax = y;
    
    /*
     * Direction:
     *   5 6 7
     *   4 X 0
     *   3 2 1
     */
    int curDir = 0;
    int perimeter = 0;
    // Homebrew perimeter algorithm
    do {
      
      dirLoop:
      for (int i = -3; i < 5; i++) {
        int dir = (curDir+i) % 8; // Find direction to test
        if (dir < 0) dir += 8; // Proper modular arithmetic modulos
        switch (dir) { // Test directions
          case 0: if (this.isAt(x+1,y))   {curDir=0;x++;      break dirLoop;}; break;
          case 1: if (this.isAt(x+1,y+1)) {curDir=1;x++;y++;  break dirLoop;}; break;
          case 2: if (this.isAt(x,y+1))   {curDir=2;y++;      break dirLoop;}; break;
          case 3: if (this.isAt(x-1,y+1)) {curDir=3;x--;y++;  break dirLoop;}; break;
          case 4: if (this.isAt(x-1,y))   {curDir=4;x--;      break dirLoop;}; break;
          case 5: if (this.isAt(x-1,y-1)) {curDir=5;x--;y--;  break dirLoop;}; break;
          case 6: if (this.isAt(x,y-1))   {curDir=6;y--;      break dirLoop;}; break;
          case 7: if (this.isAt(x+1,y-1)) {curDir=7;x++;y--;  break dirLoop;}; break;
        }
      }
      
      // if (useDebug) text(curDir,x*w+w/2,y*h+h/2);
      
      // Update boundary coordinates
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
      
      perimeter++;
      // This should never happen, but just in case, fail hard
      if (perimeter > this.maxPerimeter) throw new Error("Object detector froze");
      
    } while (x != x0 || y != y0); // Break when hitting the starting point again
    
    // Create object
    Obj obj = new Obj(xMin,yMin,xMax,yMax);
    
    // Size threshhold to combat noise
    if (obj.area < this.minObjectSize) return;
    
    // Add object
    this.objects.add(obj);
    
  }
  
}
