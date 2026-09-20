import { test } from 'node:test';
import * as assert from 'node:assert';
import { parseMermaidFlowchart } from '../src/diagrams/flowchart/parser';
import { serializeMermaidFlowchart } from '../src/diagrams/flowchart/serializer';

test('Real-World Diagram: Microservices Architecture with Subgraphs & Shapes', () => {
  const code = `
flowchart TD
    %% Client and Edge
    Client([Web & Mobile App]) --> CDN["Cloudflare CDN"]
    CDN --> Gateway["API Gateway / Envoy"]

    subgraph Core ["Core Microservices"]
        direction TB
        Gateway --> AuthSvc["Auth Service"]
        Gateway --> OrderSvc["Order Service"]
        Gateway --> PaymentSvc["Payment Service"]
        OrderSvc -.->|Pub/Sub| EventBus[("Kafka Cluster")]
    end

    subgraph Data ["Data Persistence Layer"]
        OrderSvc ==> MainDB[("PostgreSQL Primary")]
        AuthSvc --> RedisCache[("Redis Session Cache")]
        PaymentSvc ==> Vault[("Security Vault")]
    end

    EventBus --> NotificationSvc["Notification Service"]
    NotificationSvc --> UserEmail["SendGrid Email API"]
`.trim();

  const ast = parseMermaidFlowchart(code);

  assert.equal(ast.diagramType, 'flowchart');
  assert.equal(ast.direction, 'TD');

  // Verify nodes
  assert.ok(ast.nodes.has('Client'));
  assert.equal(ast.nodes.get('Client')?.shape, 'stadium');
  assert.equal(ast.nodes.get('Client')?.label, 'Web & Mobile App');

  assert.ok(ast.nodes.has('EventBus'));
  assert.equal(ast.nodes.get('EventBus')?.shape, 'cylinder');

  assert.ok(ast.nodes.has('MainDB'));
  assert.equal(ast.nodes.get('MainDB')?.shape, 'cylinder');

  // Verify subgraphs
  assert.ok(ast.subgraphs.has('Core'));
  assert.equal(ast.subgraphs.get('Core')?.label, 'Core Microservices');
  assert.equal(ast.subgraphs.get('Core')?.direction, 'TB');
  assert.ok(ast.subgraphs.get('Core')?.nodeIds.includes('AuthSvc'));
  assert.ok(ast.subgraphs.get('Core')?.nodeIds.includes('OrderSvc'));

  assert.ok(ast.subgraphs.has('Data'));
  assert.equal(ast.subgraphs.get('Data')?.label, 'Data Persistence Layer');

  // Verify arrow types
  const orderToEventBus = ast.edges.find((e) => e.from === 'OrderSvc' && e.to === 'EventBus');
  assert.ok(orderToEventBus);
  assert.equal(orderToEventBus.arrowType, 'dotted');
  assert.equal(orderToEventBus.label, 'Pub/Sub');

  const orderToDB = ast.edges.find((e) => e.from === 'OrderSvc' && e.to === 'MainDB');
  assert.ok(orderToDB);
  assert.equal(orderToDB.arrowType, 'thick');

  // Round-trip serialization & re-parse
  const serialized = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.nodes.size, ast.nodes.size);
  assert.equal(reparsed.edges.length, ast.edges.length);
  assert.equal(reparsed.subgraphs.size, ast.subgraphs.size);
});

test('Real-World Diagram: CI/CD Deployment Pipeline with Decision Gates', () => {
  const code = `
flowchart LR
    Push["git push origin main"] --> Lint["Linter & TypeCheck"]
    Lint --> Tests{"Unit Tests Passed?"}
    Tests -->|Yes| Build["Docker Build & Push"]
    Tests -->|No| NotifyFail["Slack Alert: Tests Failed"]
    Build --> SecurityScan{"Vulnerability Scan"}
    SecurityScan -->|Pass| DeployStaging["Deploy to Staging"]
    SecurityScan -->|High Severity| BlockDeploy["Block Pipeline"]
    DeployStaging --> E2E{"E2E Tests OK?"}
    E2E -->|Yes| ManualApproval{"Manual Approval Required"}
    ManualApproval -->|Approved| DeployProd["Deploy to Production (K8s)"]
    DeployProd --> SmokeTest["Post-Deployment Smoke Test"]
`.trim();

  const ast = parseMermaidFlowchart(code);

  assert.equal(ast.direction, 'LR');
  assert.ok(ast.nodes.has('Tests'));
  assert.equal(ast.nodes.get('Tests')?.shape, 'diamond');
  assert.equal(ast.nodes.get('SecurityScan')?.shape, 'diamond');
  assert.equal(ast.nodes.get('ManualApproval')?.shape, 'diamond');

  // Verify edges with labels
  const testYesEdge = ast.edges.find((e) => e.from === 'Tests' && e.to === 'Build');
  assert.ok(testYesEdge);
  assert.equal(testYesEdge.label, 'Yes');

  const testNoEdge = ast.edges.find((e) => e.from === 'Tests' && e.to === 'NotifyFail');
  assert.ok(testNoEdge);
  assert.equal(testNoEdge.label, 'No');

  // Verify round trip
  const serialized = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.nodes.size, ast.nodes.size);
  assert.equal(reparsed.edges.length, ast.edges.length);
});

test('Real-World Diagram: OAuth2 Authentication Flow with Bidirectional & Dotted Arrows', () => {
  const code = `
flowchart TD
    User["User / Resource Owner"] <--> Browser["Web Browser"]
    Browser -->|1. GET /login| AuthServer["Authorization Server (OAuth2)"]
    AuthServer -->|2. Login Form| Browser
    Browser -->|3. POST credentials| AuthServer
    AuthServer -.->|4. Authorization Code| Browser
    Browser -->|5. Redirect with Code| AppServer["Backend API Server"]
    AppServer <-->|6. Token Exchange (mTLS)| AuthServer
    AppServer -.->|7. JWT Access Token| Browser
`.trim();

  const ast = parseMermaidFlowchart(code);

  // Bidirectional arrow
  const userBrowserEdge = ast.edges.find((e) => e.from === 'User' && e.to === 'Browser');
  assert.ok(userBrowserEdge);
  assert.equal(userBrowserEdge.arrowType, 'bidirectional');

  // Dotted arrows with captions
  const tokenCodeEdge = ast.edges.find((e) => e.label === '4. Authorization Code');
  assert.ok(tokenCodeEdge);
  assert.equal(tokenCodeEdge.arrowType, 'dotted');
  assert.equal(tokenCodeEdge.from, 'AuthServer');
  assert.equal(tokenCodeEdge.to, 'Browser');

  // Token exchange bidirectional mTLS
  const tokenExchange = ast.edges.find((e) => e.from === 'AppServer' && e.to === 'AuthServer');
  assert.ok(tokenExchange);
  assert.equal(tokenExchange.arrowType, 'bidirectional');
  assert.equal(tokenExchange.label, '6. Token Exchange (mTLS)');
});

test('Shape Palette: Exhaustive test of all 10 supported Mermaid shapes', () => {
  const code = `
flowchart LR
    N1[Standard Rectangle]
    N2(Rounded Rectangle)
    N3([Stadium Shape])
    N4[[Subroutine Shape]]
    N5[(Database Cylinder)]
    N6((Circle Shape))
    N7{{Hexagon Shape}}
    N8[/Parallelogram Slanted Right/]
    N9[\\Parallelogram Slanted Left\\]
    N10{Decision Diamond}

    N1 --> N2 --> N3 --> N4 --> N5
    N5 --> N6 --> N7 --> N8 --> N9 --> N10
`.trim();

  const ast = parseMermaidFlowchart(code);

  assert.equal(ast.nodes.get('N1')?.shape, 'rectangle');
  assert.equal(ast.nodes.get('N2')?.shape, 'rounded');
  assert.equal(ast.nodes.get('N3')?.shape, 'stadium');
  assert.equal(ast.nodes.get('N4')?.shape, 'subroutine');
  assert.equal(ast.nodes.get('N5')?.shape, 'cylinder');
  assert.equal(ast.nodes.get('N6')?.shape, 'circle');
  assert.equal(ast.nodes.get('N7')?.shape, 'hexagon');
  assert.equal(ast.nodes.get('N8')?.shape, 'parallelogram');
  assert.equal(ast.nodes.get('N9')?.shape, 'parallelogram_alt');
  assert.equal(ast.nodes.get('N10')?.shape, 'diamond');

  // Verify round-trip preserves all distinct shapes exactly
  const serialized = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(serialized);

  for (let i = 1; i <= 10; i++) {
    const origShape = ast.nodes.get(`N${i}`)?.shape;
    const repShape = reparsed.nodes.get(`N${i}`)?.shape;
    assert.equal(repShape, origShape, `Node N${i} shape mismatch after roundtrip`);
  }
});

test('Special Characters, Quotes, Escapes, HTML, and Emojis in Labels', () => {
  const code = `
flowchart LR
    A["🚀 Launch: version 2.0.0-beta"]
    B["Error: #quot;Connection Reset#quot; (code: 500)"]
    C["Line 1<br/>Line 2<br>Line 3"]
    D["Array[0] & Map{key}"]
    E["**Bold Heading**<br/>*Italic Note*"]

    A -->|status: 200 OK| B
    B -->|retry count > 3| C
    C -->|payload: { active: true }| D
    D -->|done! 🎉| E
`.trim();

  const ast = parseMermaidFlowchart(code);

  assert.equal(ast.nodes.get('A')?.label, '🚀 Launch: version 2.0.0-beta');
  assert.ok(ast.nodes.get('B')?.label?.includes('Connection Reset'));
  assert.equal(ast.nodes.get('C')?.label, 'Line 1<br/>Line 2<br>Line 3');
  assert.equal(ast.nodes.get('D')?.label, 'Array[0] & Map{key}');
  assert.equal(ast.nodes.get('E')?.label, '**Bold Heading**<br/>*Italic Note*');

  // Verify edge labels with special characters
  assert.equal(ast.edges[0].label, 'status: 200 OK');
  assert.equal(ast.edges[1].label, 'retry count > 3');
  assert.equal(ast.edges[2].label, 'payload: { active: true }');
  assert.equal(ast.edges[3].label, 'done! 🎉');

  // Verify serialized output doesn't break
  const serialized = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.nodes.size, 5);
  assert.equal(reparsed.edges.length, 4);
});

test('Node Identifiers with Numbers, Dashes, Underscores, and CamelCase', () => {
  const code = `
flowchart TD
    0["Root Zero"] --> 1["Child One"]
    1 --> node_with_underscores["Node Underscore"]
    node_with_underscores --> step-dash-123["Step Dash"]
    step-dash-123 --> camelCaseNodeName["Camel Case"]
    camelCaseNodeName --> 0
`.trim();

  const ast = parseMermaidFlowchart(code);

  assert.ok(ast.nodes.has('0'));
  assert.ok(ast.nodes.has('1'));
  assert.ok(ast.nodes.has('node_with_underscores'));
  assert.ok(ast.nodes.has('step-dash-123'));
  assert.ok(ast.nodes.has('camelCaseNodeName'));
  assert.equal(ast.edges.length, 5);

  const serialized = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(serialized);
  assert.equal(reparsed.nodes.size, 5);
  assert.equal(reparsed.edges.length, 5);
});

test('All Arrow Varieties: Solid, Dotted, Thick, Open, Bidirectional', () => {
  const code = `
flowchart LR
    A -->|Solid Arrow| B
    B -.->|Dotted Arrow| C
    C ==>|Thick Arrow| D
    D ---|Open Line| E
    E <-->|Bidirectional| F
    F --> G
    G -.-> H
    H ==> I
    I --- J
    J <--> K
`.trim();

  const ast = parseMermaidFlowchart(code);

  assert.equal(ast.edges[0].arrowType, 'arrow');
  assert.equal(ast.edges[1].arrowType, 'dotted');
  assert.equal(ast.edges[2].arrowType, 'thick');
  assert.equal(ast.edges[3].arrowType, 'open');
  assert.equal(ast.edges[4].arrowType, 'bidirectional');
  assert.equal(ast.edges[5].arrowType, 'arrow');
  assert.equal(ast.edges[6].arrowType, 'dotted');
  assert.equal(ast.edges[7].arrowType, 'thick');
  assert.equal(ast.edges[8].arrowType, 'open');
  assert.equal(ast.edges[9].arrowType, 'bidirectional');

  const serialized = serializeMermaidFlowchart(ast);
  const reparsed = parseMermaidFlowchart(serialized);
  for (let i = 0; i < 10; i++) {
    assert.equal(reparsed.edges[i].arrowType, ast.edges[i].arrowType);
  }
});

test('Nested Subgraphs with Multi-Level Hierarchy', () => {
  const code = `
flowchart TD
    subgraph Cloud ["Virtual Private Cloud"]
        subgraph PublicSubnet ["Public Subnet"]
            ALB["Application Load Balancer"]
        end

        subgraph PrivateSubnet ["Private Subnet"]
            App1["App Server 1"]
            App2["App Server 2"]
        end
    end

    ALB --> App1
    ALB --> App2
`.trim();

  const ast = parseMermaidFlowchart(code);

  assert.ok(ast.subgraphs.has('Cloud'));
  assert.ok(ast.subgraphs.has('PublicSubnet'));
  assert.ok(ast.subgraphs.has('PrivateSubnet'));

  const cloudSub = ast.subgraphs.get('Cloud')!;
  assert.ok(cloudSub.subgraphIds.includes('PublicSubnet'));
  assert.ok(cloudSub.subgraphIds.includes('PrivateSubnet'));

  assert.ok(ast.subgraphs.get('PublicSubnet')?.nodeIds.includes('ALB'));
  assert.ok(ast.subgraphs.get('PrivateSubnet')?.nodeIds.includes('App1'));
  assert.ok(ast.subgraphs.get('PrivateSubnet')?.nodeIds.includes('App2'));
});
