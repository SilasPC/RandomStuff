
class Graph extends DifferenceBuffer {
  
  public final int x;
  public final int y;
  public final int w;
  public final int h;
  
  Graph (int x, int y, int w, int h, int l, int d) {
    super(l,d);
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
  
  // Draw graph curve only
  void drawCurve() {
    pushStyle();
    noFill();
    stroke(255,0,0);
    strokeWeight(2);
    beginShape();
    float x = 0;
    float dif = (float) this.w / this.bufferLength;
    float[] data = this.getData();
    for (int i = 0; i < this.available(); i++) {
      vertex(
        this.x+x,
        this.y+this.h*map(
          -data[i],
          -1f,1f, /* --> */ 0f,1f
        )
      );
      x += dif;
    }
    endShape();
    popStyle();
  }
  
  // Draw frame and graph
  void draw() {
    pushStyle();
    stroke(0);
    strokeWeight(2);
    fill(255,255,255,100);
    rect(this.x,this.y,this.w,this.h);
    this.drawCurve();
    popStyle();
  }
  
}
