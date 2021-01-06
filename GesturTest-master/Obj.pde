
final class Obj {
  
  final int xMin;
  final int xMax;
  final int yMin;
  final int yMax;
  final int width;
  final int height;
  final int area;
  
  Obj (int xMin, int yMin, int xMax, int yMax) {
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
    this.width = (xMax-xMin+1);
    this.height = (yMax-yMin+1);
    this.area = this.width * this.height;
  }
  
  // Perform AABB collision detection
  boolean intersectsWith(Obj obj, int slack) {
    return (
      obj.xMax + slack >= this.xMin &&
      obj.xMin - slack <= this.xMax &&
      obj.yMax + slack >= this.yMin &&
      obj.yMin - slack <= this.yMax
    );
  }
  
  // Merge intersecting objects
  Obj merge(Obj obj, int slack) {
    if (!this.intersectsWith(obj,slack)) return null;
    return new Obj(
      min(this.xMin,obj.xMin),min(this.yMin,obj.yMin),
      max(this.xMax,obj.xMax),max(this.yMax,obj.yMax)
    );
  }
  
  // Mark up boundary
  void drawBoundary(int camWidth, int camHeight) {
    pushStyle();
    fill(255,100,100,100);
    noStroke();
    rect(
      this.xMin*camWidth,
      this.yMin*camHeight,
      this.width*camWidth,
      this.height*camHeight
    );
    popStyle();
  }
  
  // Return wether a point is inside the boundary
  boolean contains(int x, int y) {
    return (
      x >= this.xMin &&
      x <= this.xMax &&
      y >= this.yMin &&
      y <= this.yMax
    );
  }
  
  int getX() {return (this.xMax+this.xMin)/2;}
  int getY() {return (this.yMax+this.yMin)/2;}
  
}
