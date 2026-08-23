// Scene pass, vertex stage. Attributes and matrices come from three.js's own prefix.

out vec3 vNormal;
out vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);

  vWorld = world.xyz;
  // Uniform scale, so renormalizing is enough and normalMatrix would be wasted work.
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
