CLASS zcl1_flight_quote_query DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  PUBLIC SECTION.
  INTERFACES if_rap_query_provider.
  PROTECTED SECTION.
  PRIVATE SECTION.
ENDCLASS.



CLASS zcl1_flight_quote_query IMPLEMENTATION.
  METHOD if_rap_query_provider~select.


    DATA airline     TYPE c LENGTH 3.
    DATA connection  TYPE c LENGTH 4.
    DATA flight_date TYPE d.
    DATA passengers  TYPE i.

    " *** Cubrir las features de la peticion ***
    DATA(paging)   = io_request->get_paging( ).
    DATA(sort)     = io_request->get_sort_elements( ).
    DATA(elements) = io_request->get_requested_elements( ).


    " 1) Leer los filtros ($filter) que llegan por OData
    TRY.
        DATA(ranges) = io_request->get_filter( )->get_as_ranges( ).
        LOOP AT ranges INTO DATA(pair).
          LOOP AT pair-range INTO DATA(r).
            CASE to_upper( pair-name ).
              WHEN 'AIRLINEID'.    airline     = r-low.
              WHEN 'CONNECTIONID'. connection  = r-low.
              WHEN 'FLIGHTDATE'.   flight_date = r-low.
              WHEN 'PASSENGERS'.   passengers  = r-low.
            ENDCASE.
          ENDLOOP.
        ENDLOOP.
      CATCH cx_root.
    ENDTRY.

    IF passengers <= 0.
      passengers = 1.
    ENDIF.

    DATA result TYPE STANDARD TABLE OF zce1_flight_quote.

    " 2) Leer el precio REAL del vuelo desde la vista liberada /DMO/I_Flight
    SELECT SINGLE FROM /dmo/i_flight
      FIELDS Price, CurrencyCode
      WHERE AirlineID    = @airline
        AND ConnectionID = @connection
        AND FlightDate   = @flight_date
      INTO ( @DATA(base_price), @DATA(currency) ).

    IF sy-subrc = 0.
      " 3) Regla de negocio: descuento por volumen
      DATA discount TYPE p LENGTH 3 DECIMALS 2.
      DATA reason   TYPE c LENGTH 120.
      IF passengers >= 100.
        discount = '15.00'. reason = 'Descuento por volumen (>= 100 pasajeros)'.
      ELSEIF passengers >= 50.
        discount = '10.00'. reason = 'Descuento por volumen (>= 50 pasajeros)'.
      ELSEIF passengers >= 10.
        discount = '5.00'.  reason = 'Descuento por volumen (>= 10 pasajeros)'.
      ELSE.
        discount = '0.00'.  reason = 'Sin descuento (< 10 pasajeros)'.
      ENDIF.

      DATA(net_price) = base_price * passengers * ( 100 - discount ) / 100. "cálculo del descuento

      result = VALUE #( ( airlineid    = airline
                          connectionid = connection
                          flightdate   = flight_date
                          passengers   = passengers
                          baseprice    = base_price
                          currencycode = currency
                          discountpct  = discount
                          netprice     = net_price
                          reason       = reason ) ).
    ENDIF.

    " 4) Responder
    IF io_request->is_total_numb_of_rec_requested( ).
      io_response->set_total_number_of_records( lines( result ) ).
    ENDIF.
    IF io_request->is_data_requested( ).
      io_response->set_data( result ).
    ENDIF.

  ENDMETHOD.

ENDCLASS.
