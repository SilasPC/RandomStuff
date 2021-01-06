
final int maxDeviation = 10;

boolean testForCircle(ObjectTracker.TrackedObj tObj) {
  
  ArrayList<Obj> hist = tObj.getHistory();
  
  // Just some cutoff threshold
  if (hist.size() < 8) return false;
  
  int X0 = tObj.getObj().getX(),
      Y0 = tObj.getObj().getY();
  
  int cX = X0, cY = Y0;
  
  for (Obj obj : hist) {
    cX += obj.getX();
    cY += obj.getY();
  }
  
  // This calculation is flawed. We cannot use average positions unless they are well-distributed around a center.
  // On the other hand, it makes it less likely to detect partial circles.
  cX /= 1 + hist.size();
  cY /= 1 + hist.size();
  
  float theta = 90f + (float) Math.atan((float)(cY-Y0)/(cX-X0)) * 180f / PI;
  if (cX-X0 < 0) theta += 180f;
  
  ArrayList<Float> difs = new ArrayList();
  ArrayList<Float> dists = new ArrayList();
  
  for (Obj obj : tObj.getHistory()) {
    
    int dX = cX-obj.getX(),
        dY = cY-obj.getY();
        
    float theta1 = 90f + (float) Math.atan((float)dY/dX) * 180f / PI;
    if (dX < 0) theta1 += 180f;
    
    float dif = theta-theta1;
    theta = theta1;
    if (dif<0) dif += 360;
    
    difs.add(dif);
    dists.add((float)Math.hypot(dX,dY));
    
  }
  
  float devTheta = stdDev(difs);
  float devRad = stdDev(dists);
  
  return devRad + devTheta < 2 * maxDeviation;
  
}
