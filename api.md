**Search**
----
  Returns json data definitions and references for an identifier via text or numeric id search.

* **URL**

  `/search?needle=:needle` or `/search?id=:id`

* **Method:**

  `GET`

*  **URL Params**

   **Required:**

   `needle=[string]` or `id=[integer]`

* **Data Params**

  None

* **Success Response:**

  * **Code:** 200 <br />
    **Content:** `{ defs : [ { file_name: <file_name>, lines: [] } ],   
                    refs : [ { file_name: <file_name>, lines: [] } ] }`

* **Error Response:**

  * **Code:** 500 Internal Server Error <br />
    **Content:** `"Bad search string"`

  OR

  * **Code:** 500 Internal Server Error <br />
    **Content:** `"Bad id: <id>"`

* **Sample Call:**

  ```javascript
    $.ajax({
      url: "/search?needle=off_t",
      dataType: "json",
      type : "GET",
      success : function(r) {
        console.log(r);
      }
    });
  ```

**Source**
----
  Returns json data for source directory or file.

* **URL**

  `/src/:path/:filename`

* **Method:**

  `GET`

*  **URL Params**

  None

* **Data Params**

  None

* **Success Response:**

  * **Code:** 200 <br />
    **Content:** `{ Directory : { path : [], files: [] } }`

  OR

  * **Code:** 200 <br />
    **Content:** `{ Source : { path : [], lines: [] } }`

* **Error Response:**

  * **Code:** 500 Internal Server Error <br />
    **Content:** `io::Error reading or writing path`

* **Sample Call:**

  ```javascript
    $.ajax({
      url: "/src/src/lib.rs",
      dataType: "json",
      type : "GET",
      success : function(r) {
        console.log(r);
      }
    });
  ```

**Find impls**
----
  Returns json array of impls for a struct or enum by id.

* **URL**

  `/find?impls=:id`

* **Method:**

  `GET`

*  **URL Params**

   **Required:**

   `impls=[integer]`

* **Data Params**

  None

* **Success Response:**

  * **Code:** 200 <br />
    **Content:** `{ results : [ { file_name : <filename>, lines: [] } ] }`

* **Error Response:**

  * **Code:** 500 Internal Server Error <br />
    **Content:** `"Unknown argument to find"`

  OR

  * **Code:** 500 Internal Server Error <br />
    **Content:** `"Bad id: <id>"`

* **Sample Call:**

  ```javascript
    $.ajax({
      url: "/find?impls=8",
      dataType: "json",
      type : "GET",
      success : function(r) {
        console.log(r);
      }
    });
  ```
