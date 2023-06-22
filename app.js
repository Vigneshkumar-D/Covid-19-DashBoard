const express = require("express");
const app = express();


const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const jwt = require("jsonwebtoken");

app.use(express.json());
const bcrypt = require("bcrypt");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;


const initializeDbAndServer = async () =>{
    try{
       db = await open ({
           filename: dbPath,
            driver: sqlite3.Database
                      
       });
       app.listen(3000, () => {
           console.log("Server running at http://localhost:3000/");
       })
    }
    catch(error){
        console.log(`DB Error: ${error.message}`);
        process.exit(1);
    }
}
initializeDbAndServer();


const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if(authHeader !== undefined){
        jwtToken = authHeader.split(" ")[1]; 
        console.log(jwtToken)
    }
    if(authHeader === undefined){
        response.status(401);
        response.send("Invalid JWT Token");     
    } else{
            jwt.verify(jwtToken, "SECRET_KEY", (error, payload) => {
             if(error){
                 response.status(401);
                 response.send("Invalid JWT Token")
              }
              else{
               request.username = payload.username                        
               next();
                                 
             }
         });      
    }
};
// 
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
    await db.run(createUserQuery);
    response.send(`User created successfully`);
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//user login API
app.post("/login/", async(request, response) => {
        
        const { username, password } = request.body;
        const selectUserQuery = `
        SELECT *
        FROM
        user
        WHERE username = '${username}'`;

        const dbUser = await db.get(selectUserQuery);
        console.log(dbUser)
        if(dbUser === undefined){
            response.status(400);
            response.send("Invalid user");
        } else {
            const isPasswordSame = await bcrypt.compare(password, dbUser.password);
            if (isPasswordSame === true){
                const payload = {
                    username:username                    
                };
                const jwtToken = await jwt.sign(payload, "SECRET_KEY"); 
                response.send({jwtToken}); 
                    }  
            else{
            response.status(400);
            response.send("Invalid password");
            }         
        } 
        
});

// get states API

app.get("/states/", authenticateToken, async(request, response) => {
    const getStatesQuery = `
    SELECT *
    FROM 
    state;`;
    const dbResponse = await db.all(getStatesQuery);
    
    const stateList = []
    for (state of dbResponse){
        const stateObject = {
            stateId: state.state_id,
            stateName: state.state_name,
            population: state.population
        };

        stateList.push(stateObject);
        
    }

     response.send(stateList);  

});

// get state API

app.get("/states/:stateId/", authenticateToken, async(request, response) => {
 
const { stateId } = request.params;

const selectStateQuery = `
SELECT *
FROM state
WHERE state_id = '${stateId}';`;

const dbResponse = await db.get(selectStateQuery);

const stateObject = {
    stateId: dbResponse.state_id,
    stateName: dbResponse.state_name,
    population: dbResponse.population,
}
response.send(stateObject)
    
});

// Add District API

app.post("/districts/", authenticateToken, async(request, response) => {
    const { districtName,
  stateId,
  cases,
  cured,
  active,
  deaths } = request.body;

  const addDistrictQuery = `
  INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
  VALUES ( '${districtName}',
  '${stateId}',
  '${cases}',
  '${cured}',
    '${active}',
  '${deaths}'
  )`

  await db.run(addDistrictQuery);

  response.send("District Successfully Added")
});

// get District API
app.get("/districts/:districtId/", authenticateToken, async(request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT *
    FROM district
    WHERE district_id = '${districtId}';`;

    const dbResponse = await db.get(getDistrictQuery);
    const districtObject = {
        districtId: dbResponse.district_id,
        districtName:dbResponse.district_name ,
        stateId: dbResponse.state_id,
        cases: dbResponse.cases,
        cured: dbResponse.cured,
        active: dbResponse.active,
        deaths: dbResponse.deaths
    };
response.send(districtObject);
});

// Delete district API

app.delete("/districts/:districtId/", authenticateToken, async(request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE 
    FROM district
    WHERE district_id = '${districtId}'`

    await db.run(deleteDistrictQuery);
    response.send("District Removed");

});

//Update District API

app.put("/districts/:districtId/", authenticateToken, async(request, response) => {
    const { districtId } = request.params;
    const { districtName,
  stateId,
  cases,
  cured,
  active,
  deaths } = request.body;

  const updateDistrictQuery = `
  UPDATE district
  SET district_name = '${districtName}',
  state_id = '${stateId}',
  cases = '${cases}',
  cured = '${cured}',
  active = '${active}',
  deaths = '${deaths}'
  
  WHERE district_id = '${districtId}'`
  await db.run(updateDistrictQuery);
  response.send("District Details Updated");

});

// Get State Statistics API
app.get("/states/:stateId/stats/", authenticateToken, async(request, response) => {
    const { stateId } = request.params;

    const getStateStatsQuery = `
    SELECT 
     sum(district.cases) as totalCases,
        sum(district.cured) as totalCured,
        sum(district.active) as totalActive,
        sum(district.deaths) as totalDeaths
    FROM district
    INNER JOIN state
    ON district.state_id = state.state_id 
    WHERE state.state_id = '${stateId}'`

    const dbResponse = await db.get(getStateStatsQuery);
    response.send(dbResponse);
});

module.exports = app;