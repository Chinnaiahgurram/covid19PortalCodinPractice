const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

app.use(express.json());
let db = null;

const initializerDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("This server running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`Db Server at ${error.message}`);
    process.exit(1);
  }
};
initializerDbAndServer();

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const SelectUserQuery = `SELECT * FROM user WHERE username = '${username}' `;
  const dbUser = await db.get(SelectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state`;
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) =>
      convertStateDbObjectToResponseObject(eachState)
    )
  );
});
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateId = `
    SELECT * FROM state WHERE state_id=${stateId}`;
  const state = await db.get(getStateId);
  response.send(convertStateDbObjectToResponseObject(state));
});

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const getDistricts = `
    INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
    VALUES(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}

    )
   `;

  await db.run(getDistricts);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictId = `
  SELECT * FROM district WHERE district_id=${districtId} `;
    const district = await db.get(getDistrictId);
    response.send(convertDistrictDbObjectToResponseObject(district));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictId = `
  DELETE FROM district WHERE district_id=${districtId}`;
    await db.run(deleteDistrictId);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictId = `
  UPDATE district 
  SET 
  district_name='${districtName}',
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths}
   WHERE 
   district_id=${districtId} 
  `;
    await db.run(updateDistrictId);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatesQuery = `
  SELECT  
  SUM(cases),
  SUM(cured),
  SUM(active),
  SUM(deaths)
  FROM
  district 
     WHERE
     state_id=${stateId} `;
    const stats = await db.get(getStateStatesQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);
module.exports = app;
